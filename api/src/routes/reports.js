const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// Get Sales Report (Page 3)
router.get('/reports/sales', async (req, res) => {
    const {from, to} = req.query;
    const invoices = await prisma.invoice.findMany({
        where: {
            type: 'SALE',
            date: {
                gte: new Date(from),
                lte: new Date(to)
            }
        },
        include: {
            customer: true,
            salesman: true,
            items: {include: {product: true}}
        }
    });
    res.json(invoices);
});

// 1. Sales Report (Filtered by Date)
router.get('/reports/sales', async (req, res) => {
    const {from, to} = req.query;

    try {
        const whereClause = {type: 'SALE'};
        if (from && to) {
            whereClause.date = {
                gte: new Date(from),
                lte: new Date(to)
            };
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: {
                customer: true,
                salesman: true,
                items: {include: {product: true}}
            },
            orderBy: {date: 'desc'}
        });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// 2. Stock Report with N+1 Query Problem
// router.get('/reports/stock', async (req, res) => {
//     try {
//         // Get all products
//         const products = await prisma.product.findMany();
//
//         // For each product, calculate purchased, sold, returned, and balance
//         const stockData = await Promise.all(products.map(async (product) => {
//             // Total Purchased
//             const purchased = await prisma.invoiceItem.aggregate({
//                 _sum: {qty: true},
//                 where: {productId: product.id, invoice: {type: 'PURCHASE'}}
//             });
//
//             // Total Sold
//             const sold = await prisma.invoiceItem.aggregate({
//                 _sum: {qty: true},
//                 where: {productId: product.id, invoice: {type: 'SALE'}}
//             });
//
//             // Total Returned
//             const returned = await prisma.invoiceItem.aggregate({
//                 _sum: {qty: true},
//                 where: {productId: product.id, invoice: {type: 'RETURN'}}
//             });
//
//             const pQty = purchased._sum.qty || 0;
//             const sQty = sold._sum.qty || 0;
//             const rQty = returned._sum.qty || 0;
//             const balance = pQty - sQty + rQty;
//
//             return {
//                 id: product.id,
//                 name: product.name,
//                 purchasedQty: pQty,
//                 soldQty: sQty,
//                 returnQty: rQty,
//                 balanceQty: balance
//             };
//         }));
//
//         res.json(stockData);
//     } catch (error) {
//         res.status(500).json({error: error.message});
//     }
// });
router.get('/reports/stock', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            select: { id: true, name: true },
        });

        // One query each for PURCHASE, SALE, RETURN
        const [purchased, sold, returned] = await Promise.all([
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

        // Build lookup maps
        const toMap = (rows) =>
            new Map(rows.map((r) => [r.productId, r._sum.qty || 0]));

        const purchasedMap = toMap(purchased);
        const soldMap = toMap(sold);
        const returnedMap = toMap(returned);

        const stockData = products.map((p) => {
            const pQty = purchasedMap.get(p.id) || 0;
            const sQty = soldMap.get(p.id) || 0;
            const rQty = returnedMap.get(p.id) || 0;
            return {
                id: p.id,
                name: p.name,
                purchasedQty: pQty,
                soldQty: sQty,
                returnQty: rQty,
                balanceQty: pQty - sQty + rQty,
            };
        });

        res.json(stockData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Same Stock Report with 1 Raw Query
// router.get('/reports/stock', async (req, res) => {
//     try {
//         const rows = await prisma.$queryRaw`
//       SELECT
//         p.id,
//         p.name,
//         COALESCE(SUM(CASE WHEN i.type = 'PURCHASE' THEN ii.qty END), 0)::int AS "purchasedQty",
//         COALESCE(SUM(CASE WHEN i.type = 'SALE'     THEN ii.qty END), 0)::int AS "soldQty",
//         COALESCE(SUM(CASE WHEN i.type = 'RETURN'   THEN ii.qty END), 0)::int AS "returnQty",
//         (
//           COALESCE(SUM(CASE WHEN i.type = 'PURCHASE' THEN ii.qty END), 0)
//           - COALESCE(SUM(CASE WHEN i.type = 'SALE'   THEN ii.qty END), 0)
//           + COALESCE(SUM(CASE WHEN i.type = 'RETURN' THEN ii.qty END), 0)
//         )::int AS "balanceQty"
//       FROM "Product" p
//       LEFT JOIN "InvoiceItem" ii ON ii."productId" = p.id
//       LEFT JOIN "Invoice"     i  ON i.id = ii."invoiceId"
//       GROUP BY p.id, p.name
//       ORDER BY p.name;
//     `;
//         res.json(rows);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// 3. All Cash Record (Overall Summary)
router.get('/reports/cash-summary', async (req, res) => {
    try {
        const records = await prisma.cashRecord.findMany({
            include: {customer: true},
            orderBy: {date: 'desc'}
        });

        const totalCash = records.reduce((sum, record) => {
            return record.type === 'RECEIVED' ? sum + record.amount : sum - record.amount;
        }, 0);

        res.json({records, totalCash});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;
