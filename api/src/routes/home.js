const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

router.get('/dashboard', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Run independent queries in parallel
        const [
            todaySalesAgg,
            cashAgg,
            totalProducts,
            products,
            purchasedGroups,
            soldGroups,
            returnedGroups,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'SALE', date: { gte: startOfDay, lte: endOfDay } },
            }),

            // Aggregate cash in DB instead of loading every row
            prisma.cashRecord.groupBy({
                by: ['type'],
                _sum: { amount: true },
            }),

            prisma.product.count(),

            prisma.product.findMany({ select: { id: true, name: true } }),

            prisma.invoiceItem.groupBy({
                by: ['productId'],
                _sum: { qty: true },
                where: { invoice: { type: 'PURCHASE' } },
            }),
            prisma.invoiceItem.groupBy({
                by: ['productId'],
                _sum: { qty: true },
                where: { invoice: { type: 'SALE' } },
            }),
            prisma.invoiceItem.groupBy({
                by: ['productId'],
                _sum: { qty: true },
                where: { invoice: { type: 'RETURN' } },
            }),
        ]);

        // Cash in hand
        const totalCash = cashAgg.reduce((sum, row) => {
            const amount = row._sum.amount || 0;
            return row.type === 'RECEIVED' ? sum + amount : sum - amount;
        }, 0);

        // Build lookup maps — O(1) per product
        const toMap = (rows) =>
            new Map(rows.map((r) => [r.productId, r._sum.qty || 0]));
        const purchasedMap = toMap(purchasedGroups);
        const soldMap = toMap(soldGroups);
        const returnedMap = toMap(returnedGroups);

        // Compute balances for all products in memory
        const balances = products.map((p) => ({
            name: p.name,
            balance:
                (purchasedMap.get(p.id) || 0) -
                (soldMap.get(p.id) || 0) +
                (returnedMap.get(p.id) || 0),
        }));

        // Lowest 5 that are actually below threshold
        const LOW_STOCK_THRESHOLD = 10;
        const lowStockItems = balances
            .filter((b) => b.balance < LOW_STOCK_THRESHOLD)
            .sort((a, b) => a.balance - b.balance) // ascending → lowest first
            .slice(0, 5);

        res.json({
            todaySales: todaySalesAgg._sum.totalAmount || 0,
            totalCash,
            totalProducts,
            lowStockItems,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

// This can be used to even improve load time
// const stockRows = await prisma.$queryRaw`
//   SELECT
//     p.id,
//     p.name,
//     COALESCE(SUM(CASE WHEN i.type = 'PURCHASE' THEN ii.qty END), 0)::int
//       - COALESCE(SUM(CASE WHEN i.type = 'SALE'    THEN ii.qty END), 0)::int
//       + COALESCE(SUM(CASE WHEN i.type = 'RETURN'  THEN ii.qty END), 0)::int
//       AS balance
//   FROM "Product" p
//   LEFT JOIN "InvoiceItem" ii ON ii."productId" = p.id
//   LEFT JOIN "Invoice"     i  ON i.id = ii."invoiceId"
//   GROUP BY p.id, p.name
//   HAVING (
//     COALESCE(SUM(CASE WHEN i.type = 'PURCHASE' THEN ii.qty END), 0)
//     - COALESCE(SUM(CASE WHEN i.type = 'SALE'   THEN ii.qty END), 0)
//     + COALESCE(SUM(CASE WHEN i.type = 'RETURN' THEN ii.qty END), 0)
//   ) < 10
//   ORDER BY balance ASC
//   LIMIT 5;
// `;