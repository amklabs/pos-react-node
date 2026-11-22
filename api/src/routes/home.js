const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { PAYMENT_STATUS } = require('../utils/payments');
const { summarizeInvoiceProfit, round2 } = require('../utils/profit');

const router = express.Router();
router.use(authenticateToken);

const LOW_STOCK_THRESHOLD = 10;

function dayBounds(now = new Date()) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return { startOfDay, endOfDay };
}

router.get('/dashboard', async (req, res, next) => {
    try {
        const { startOfDay, endOfDay } = dayBounds();
        const todayFilter = { gte: startOfDay, lte: endOfDay };

        const [
            todaySalesAgg,
            todaySalesCount,
            todayPurchasesAgg,
            todayReturnsAgg,
            todayCashReceivedAgg,
            cashAgg,
            unpaidSales,
            totalProducts,
            products,
            purchasedGroups,
            soldGroups,
            returnedGroups,
            recentSales,
            todayProfitInvoices,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'SALE', date: todayFilter },
            }),
            prisma.invoice.count({
                where: { type: 'SALE', date: todayFilter },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'PURCHASE', date: todayFilter },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: 'RETURN', date: todayFilter },
            }),
            prisma.cashRecord.aggregate({
                _sum: { amount: true },
                where: { type: 'RECEIVED', date: todayFilter },
            }),
            prisma.cashRecord.groupBy({
                by: ['type'],
                _sum: { amount: true },
            }),
            prisma.invoice.findMany({
                where: {
                    type: 'SALE',
                    paymentStatus: { not: PAYMENT_STATUS.PAID },
                },
                select: {
                    totalAmount: true,
                    payments: {
                        where: { type: 'RECEIVED' },
                        select: { amount: true },
                    },
                },
            }),
            prisma.product.count({ where: { isActive: true } }),
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
            }),
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
            prisma.invoice.findMany({
                where: { type: 'SALE' },
                orderBy: { date: 'desc' },
                take: 8,
                select: {
                    id: true,
                    invoiceNo: true,
                    date: true,
                    totalAmount: true,
                    paymentStatus: true,
                    customer: { select: { name: true } },
                    town: { select: { name: true } },
                },
            }),
            prisma.invoice.findMany({
                where: {
                    type: { in: ['SALE', 'RETURN'] },
                    date: todayFilter,
                },
                select: {
                    type: true,
                    items: {
                        select: {
                            qty: true,
                            rate: true,
                            discount: true,
                            total: true,
                            costRate: true,
                        },
                    },
                },
            }),
        ]);

        const totalCash = cashAgg.reduce((sum, row) => {
            const amount = Number(row._sum.amount || 0);
            return row.type === 'RECEIVED' ? sum + amount : sum - amount;
        }, 0);

        const outstandingReceivables = unpaidSales.reduce((sum, inv) => {
            const paid = (inv.payments || []).reduce(
                (s, p) => s + Number(p.amount || 0),
                0
            );
            return sum + Math.max(0, Number(inv.totalAmount) - paid);
        }, 0);

        const toMap = (rows) =>
            new Map(rows.map((r) => [r.productId, Number(r._sum.qty || 0)]));
        const purchasedMap = toMap(purchasedGroups);
        const soldMap = toMap(soldGroups);
        const returnedMap = toMap(returnedGroups);

        const lowStockItems = products
            .map((p) => ({
                id: p.id,
                name: p.name,
                balance:
                    (purchasedMap.get(p.id) || 0) -
                    (soldMap.get(p.id) || 0) +
                    (returnedMap.get(p.id) || 0),
            }))
            .filter((b) => b.balance < LOW_STOCK_THRESHOLD)
            .sort((a, b) => a.balance - b.balance)
            .slice(0, 8);

        const todayProfit = round2(
            todayProfitInvoices.reduce(
                (sum, inv) => sum + summarizeInvoiceProfit(inv).signedProfit,
                0
            )
        );

        res.json({
            todaySales: Number(todaySalesAgg._sum.totalAmount || 0),
            todaySalesCount,
            todayPurchases: Number(todayPurchasesAgg._sum.totalAmount || 0),
            todayReturns: Number(todayReturnsAgg._sum.totalAmount || 0),
            todayCashReceived: Number(todayCashReceivedAgg._sum.amount || 0),
            todayProfit,
            totalCash,
            outstandingReceivables: Number(outstandingReceivables.toFixed(2)),
            unpaidInvoiceCount: unpaidSales.length,
            totalProducts,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            lowStockItems,
            recentSales: recentSales.map((inv) => ({
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                totalAmount: Number(inv.totalAmount),
                paymentStatus: inv.paymentStatus,
                customerName: inv.customer?.name || 'Cash Sale',
                townName: inv.town?.name || '',
            })),
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
