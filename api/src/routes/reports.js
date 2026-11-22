const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');
const { summarizeInvoiceProfit, round2 } = require('../utils/profit');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

function dayStart(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function dayEnd(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

// Sales Report (Filtered by Date)
router.get('/reports/sales', async (req, res, next) => {
    const { from, to, salesmanId, townId, paymentStatus } = req.query;

    try {
        const whereClause = { type: 'SALE' };

        if (from || to) {
            whereClause.date = {};
            if (from) {
                const start = dayStart(from);
                if (!start) return res.status(400).json({ error: 'Invalid from date' });
                whereClause.date.gte = start;
            }
            if (to) {
                const end = dayEnd(to);
                if (!end) return res.status(400).json({ error: 'Invalid to date' });
                whereClause.date.lte = end;
            }
        }

        if (salesmanId) whereClause.salesmanId = Number(salesmanId);
        if (townId) whereClause.townId = Number(townId);
        if (paymentStatus && paymentStatus !== 'all') {
            whereClause.paymentStatus = String(paymentStatus);
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: {
                customer: { select: { id: true, name: true, phone: true } },
                salesman: { select: { id: true, name: true } },
                town: { select: { id: true, name: true } },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                company: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
                payments: {
                    where: { type: 'RECEIVED' },
                    select: { amount: true },
                },
            },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
        });

        const rows = invoices.map((inv) => {
            const paidAmount = (inv.payments || []).reduce(
                (s, p) => s + Number(p.amount || 0),
                0
            );
            const totalAmount = Number(inv.totalAmount || 0);
            const totalDiscount = Number(inv.totalDiscount || 0);
            const items = (inv.items || []).map((item) => {
                const qty = Number(item.qty || 0);
                const rate = Number(item.rate || 0);
                const discount = Number(item.discount || 0);
                const lineTotal = Number(
                    (item.total != null
                        ? Number(item.total)
                        : qty * rate - discount
                    ).toFixed(2)
                );
                return {
                    id: item.id,
                    productId: item.productId,
                    productName: item.product?.name || '—',
                    companyName: item.product?.company?.name || null,
                    qty,
                    rate,
                    discount,
                    lineTotal,
                };
            });

            return {
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                paymentStatus: inv.paymentStatus,
                customerId: inv.customer?.id || null,
                customerName: inv.customer?.name || 'Cash Sale',
                salesmanId: inv.salesman?.id || null,
                salesmanName: inv.salesman?.name || null,
                townId: inv.town?.id || null,
                townName: inv.town?.name || null,
                totalDiscount,
                totalAmount,
                paidAmount: Number(paidAmount.toFixed(2)),
                balanceDue: Number(Math.max(0, totalAmount - paidAmount).toFixed(2)),
                items,
            };
        });

        const summary = rows.reduce(
            (acc, inv) => {
                acc.invoiceCount += 1;
                acc.totalAmount += inv.totalAmount;
                acc.totalDiscount += inv.totalDiscount;
                acc.paidAmount += inv.paidAmount;
                acc.balanceDue += inv.balanceDue;
                for (const item of inv.items) {
                    acc.lineCount += 1;
                    acc.totalQty += item.qty;
                }
                if (inv.paymentStatus === 'Paid') acc.paidCount += 1;
                else if (inv.paymentStatus === 'PartialPaid') acc.partialCount += 1;
                else acc.pendingCount += 1;
                return acc;
            },
            {
                invoiceCount: 0,
                lineCount: 0,
                totalQty: 0,
                totalAmount: 0,
                totalDiscount: 0,
                paidAmount: 0,
                balanceDue: 0,
                paidCount: 0,
                partialCount: 0,
                pendingCount: 0,
            }
        );

        res.json({
            from: from || null,
            to: to || null,
            invoices: rows,
            summary: {
                ...summary,
                totalQty: Number(summary.totalQty.toFixed(4)),
                totalAmount: Number(summary.totalAmount.toFixed(2)),
                totalDiscount: Number(summary.totalDiscount.toFixed(2)),
                paidAmount: Number(summary.paidAmount.toFixed(2)),
                balanceDue: Number(summary.balanceDue.toFixed(2)),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Stock Report: on-hand = PURCHASE - SALE + RETURN (customer returns add stock back)
router.get('/reports/stock', async (req, res, next) => {
    try {
        const showInactive = req.query.showInactive === 'true';
        const lowStockThreshold = Math.max(
            0,
            Number(req.query.lowStockThreshold ?? 10) || 10
        );

        const products = await prisma.product.findMany({
            where: showInactive ? {} : { isActive: true },
            select: {
                id: true,
                name: true,
                isActive: true,
                lastPRate: true,
                lastSRate: true,
                company: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
        });

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

        const toMap = (rows) =>
            new Map(rows.map((r) => [r.productId, Number(r._sum.qty || 0)]));

        const purchasedMap = toMap(purchased);
        const soldMap = toMap(sold);
        const returnedMap = toMap(returned);

        const items = products.map((p) => {
            const purchasedQty = purchasedMap.get(p.id) || 0;
            const soldQty = soldMap.get(p.id) || 0;
            const returnQty = returnedMap.get(p.id) || 0;
            const balanceQty = Number((purchasedQty - soldQty + returnQty).toFixed(4));
            const lastPRate = Number(p.lastPRate || 0);
            const lastSRate = Number(p.lastSRate || 0);
            const stockValue = Number((balanceQty * lastPRate).toFixed(2));

            return {
                id: p.id,
                name: p.name,
                isActive: p.isActive,
                companyId: p.company?.id || null,
                companyName: p.company?.name || null,
                purchasedQty: Number(purchasedQty.toFixed(4)),
                soldQty: Number(soldQty.toFixed(4)),
                returnQty: Number(returnQty.toFixed(4)),
                balanceQty,
                lastPRate,
                lastSRate,
                stockValue,
                isLowStock: balanceQty < lowStockThreshold,
                isOutOfStock: balanceQty <= 0,
            };
        });

        const totals = items.reduce(
            (acc, row) => {
                acc.purchasedQty += row.purchasedQty;
                acc.soldQty += row.soldQty;
                acc.returnQty += row.returnQty;
                acc.balanceQty += row.balanceQty;
                acc.stockValue += row.stockValue;
                if (row.isLowStock) acc.lowStockCount += 1;
                if (row.isOutOfStock) acc.outOfStockCount += 1;
                return acc;
            },
            {
                purchasedQty: 0,
                soldQty: 0,
                returnQty: 0,
                balanceQty: 0,
                stockValue: 0,
                lowStockCount: 0,
                outOfStockCount: 0,
            }
        );

        res.json({
            lowStockThreshold,
            items,
            totals: {
                productCount: items.length,
                purchasedQty: Number(totals.purchasedQty.toFixed(4)),
                soldQty: Number(totals.soldQty.toFixed(4)),
                returnQty: Number(totals.returnQty.toFixed(4)),
                balanceQty: Number(totals.balanceQty.toFixed(4)),
                stockValue: Number(totals.stockValue.toFixed(2)),
                lowStockCount: totals.lowStockCount,
                outOfStockCount: totals.outOfStockCount,
            },
        });
    } catch (error) {
        next(error);
    }
});

// 3. All Cash Record (Overall Summary)
router.get('/reports/cash-summary', async (req, res, next) => {
    try {
        const records = await prisma.cashRecord.findMany({
            include: { customer: true },
            orderBy: { date: 'desc' },
        });

        const totalCash = records.reduce((sum, record) => {
            const amount = Number(record.amount);
            return record.type === 'RECEIVED' ? sum + amount : sum - amount;
        }, 0);

        res.json({ records, totalCash });
    } catch (error) {
        next(error);
    }
});

// Profit Report — SALE + RETURN with snapped costRate (paginated)
// Query: from, to, type, q, page, pageSize
router.get('/reports/profit', async (req, res, next) => {
    const { from, to, type, q } = req.query;

    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
        const skip = (page - 1) * pageSize;

        const whereClause = {};

        if (type === 'SALE' || type === 'RETURN') {
            whereClause.type = type;
        } else {
            whereClause.type = { in: ['SALE', 'RETURN'] };
        }

        if (from || to) {
            whereClause.date = {};
            if (from) {
                const start = dayStart(from);
                if (!start) return res.status(400).json({ error: 'Invalid from date' });
                whereClause.date.gte = start;
            }
            if (to) {
                const end = dayEnd(to);
                if (!end) return res.status(400).json({ error: 'Invalid to date' });
                whereClause.date.lte = end;
            }
        }

        const search = typeof q === 'string' ? q.trim() : '';
        if (search) {
            whereClause.OR = [
                { invoiceNo: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { salesman: { name: { contains: search, mode: 'insensitive' } } },
                { town: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const itemSelect = {
            qty: true,
            rate: true,
            discount: true,
            total: true,
            costRate: true,
        };

        const [total, pageInvoices, summaryInvoices] = await Promise.all([
            prisma.invoice.count({ where: whereClause }),
            prisma.invoice.findMany({
                where: whereClause,
                include: {
                    customer: { select: { id: true, name: true } },
                    salesman: { select: { id: true, name: true } },
                    town: { select: { id: true, name: true } },
                    items: { select: itemSelect },
                },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                skip,
                take: pageSize,
            }),
            // Full filtered set (minimal fields) so KPI summary stays period-accurate
            prisma.invoice.findMany({
                where: whereClause,
                select: {
                    type: true,
                    items: { select: itemSelect },
                },
            }),
        ]);

        const rows = pageInvoices.map((inv) => {
            const profit = summarizeInvoiceProfit(inv);
            return {
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                type: inv.type,
                date: inv.date,
                customerName: inv.customer?.name || (inv.type === 'SALE' ? 'Cash Sale' : '—'),
                salesmanName: inv.salesman?.name || null,
                townName: inv.town?.name || null,
                netSales: profit.netSales,
                totalCost: profit.totalCost,
                grossProfit: profit.grossProfit,
                signedProfit: profit.signedProfit,
                marginPct: profit.marginPct,
            };
        });

        const summary = summaryInvoices.reduce(
            (acc, inv) => {
                const profit = summarizeInvoiceProfit(inv);
                if (inv.type === 'SALE') {
                    acc.saleCount += 1;
                    acc.saleNet += profit.netSales;
                    acc.saleCost += profit.totalCost;
                    acc.saleProfit += profit.grossProfit;
                } else if (inv.type === 'RETURN') {
                    acc.returnCount += 1;
                    acc.returnNet += profit.netSales;
                    acc.returnCost += profit.totalCost;
                    acc.returnProfitReversed += profit.grossProfit;
                }
                acc.netProfit += profit.signedProfit;
                return acc;
            },
            {
                saleCount: 0,
                returnCount: 0,
                saleNet: 0,
                saleCost: 0,
                saleProfit: 0,
                returnNet: 0,
                returnCost: 0,
                returnProfitReversed: 0,
                netProfit: 0,
            }
        );

        const marginPct =
            summary.saleNet > 0
                ? round2((summary.netProfit / summary.saleNet) * 100)
                : null;

        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const pageNetProfit = round2(
            rows.reduce((s, row) => s + Number(row.signedProfit || 0), 0)
        );

        res.json({
            from: from || null,
            to: to || null,
            invoices: rows,
            page,
            pageSize,
            total,
            totalPages,
            pageNetProfit,
            summary: {
                saleCount: summary.saleCount,
                returnCount: summary.returnCount,
                saleNet: round2(summary.saleNet),
                saleCost: round2(summary.saleCost),
                saleProfit: round2(summary.saleProfit),
                returnNet: round2(summary.returnNet),
                returnCost: round2(summary.returnCost),
                returnProfitReversed: round2(summary.returnProfitReversed),
                netProfit: round2(summary.netProfit),
                marginPct,
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
