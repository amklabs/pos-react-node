const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { parseId, httpError } = require('../utils/validate');

const router = express.Router();
router.use(authenticateToken);

function toAmountMap(rows) {
    const map = new Map();
    for (const row of rows) {
        if (row.customerId == null) continue;
        const value = row._sum.totalAmount ?? row._sum.amount ?? 0;
        map.set(row.customerId, Number(value));
    }
    return map;
}

// Summary table: net payable per customer (SALE - RETURN - RECEIVED)
router.get('/ledger/customers', async (req, res, next) => {
    try {
        const [customers, salesAgg, returnsAgg, cashAgg] = await Promise.all([
            prisma.customer.findMany({
                include: { town: true },
                orderBy: { name: 'asc' },
            }),
            prisma.invoice.groupBy({
                by: ['customerId'],
                where: { type: 'SALE', customerId: { not: null } },
                _sum: { totalAmount: true },
            }),
            prisma.invoice.groupBy({
                by: ['customerId'],
                where: { type: 'RETURN', customerId: { not: null } },
                _sum: { totalAmount: true },
            }),
            prisma.cashRecord.groupBy({
                by: ['customerId'],
                where: { type: 'RECEIVED', customerId: { not: null } },
                _sum: { amount: true },
            }),
        ]);

        const salesMap = toAmountMap(salesAgg);
        const returnsMap = toAmountMap(returnsAgg);
        const cashMap = toAmountMap(cashAgg);

        const rows = customers.map((c) => {
            const totalSales = salesMap.get(c.id) || 0;
            const totalReturns = returnsMap.get(c.id) || 0;
            const totalReceived = cashMap.get(c.id) || 0;
            const netPayable = Number((totalSales - totalReturns - totalReceived).toFixed(2));

            return {
                id: c.id,
                name: c.name,
                phone: c.phone,
                town: c.town?.name || null,
                townId: c.townId,
                isActive: c.isActive,
                totalSales: Number(totalSales.toFixed(2)),
                totalReturns: Number(totalReturns.toFixed(2)),
                totalReceived: Number(totalReceived.toFixed(2)),
                netPayable,
            };
        });

        const totals = rows.reduce(
            (acc, r) => {
                acc.totalSales += r.totalSales;
                acc.totalReturns += r.totalReturns;
                acc.totalReceived += r.totalReceived;
                acc.netPayable += r.netPayable;
                return acc;
            },
            { totalSales: 0, totalReturns: 0, totalReceived: 0, netPayable: 0 }
        );

        res.json({
            customers: rows,
            totals: {
                totalSales: Number(totals.totalSales.toFixed(2)),
                totalReturns: Number(totals.totalReturns.toFixed(2)),
                totalReceived: Number(totals.totalReceived.toFixed(2)),
                netPayable: Number(totals.netPayable.toFixed(2)),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Detail ledger for one customer
router.get('/customers/:id/ledger', async (req, res, next) => {
    try {
        const customerId = parseId(req.params.id, 'customer id');

        const [sales, cash, returns, customer] = await Promise.all([
            prisma.invoice.findMany({
                where: { customerId, type: 'SALE' },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    date: true,
                    invoiceNo: true,
                    totalAmount: true,
                    paymentStatus: true,
                },
            }),
            prisma.cashRecord.findMany({
                where: { customerId, type: 'RECEIVED' },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    date: true,
                    amount: true,
                    note: true,
                    invoiceId: true,
                    invoice: { select: { invoiceNo: true } },
                },
            }),
            prisma.invoice.findMany({
                where: { customerId, type: 'RETURN' },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    date: true,
                    invoiceNo: true,
                    totalAmount: true,
                },
            }),
            prisma.customer.findUnique({
                where: { id: customerId },
                include: { town: true },
            }),
        ]);

        if (!customer) throw httpError(404, 'Customer not found');

        const transactions = [
            ...sales.map((s) => ({
                id: `sale-${s.id}`,
                date: s.date,
                type: 'SALE',
                ref: s.invoiceNo,
                invoiceId: s.id,
                paymentStatus: s.paymentStatus,
                amount: Number(s.totalAmount),
                debit: Number(s.totalAmount),
                credit: 0,
            })),
            ...returns.map((r) => ({
                id: `return-${r.id}`,
                date: r.date,
                type: 'RETURN',
                ref: r.invoiceNo,
                invoiceId: r.id,
                amount: Number(r.totalAmount),
                debit: 0,
                credit: Number(r.totalAmount),
            })),
            ...cash.map((c) => ({
                id: `cash-${c.id}`,
                date: c.date,
                type: 'RECEIVED',
                ref: c.invoice?.invoiceNo
                    ? `Payment #${c.invoice.invoiceNo}`
                    : c.note || 'Cash received',
                invoiceId: c.invoiceId,
                amount: Number(c.amount),
                debit: 0,
                credit: Number(c.amount),
            })),
        ].sort((a, b) => {
            const d = new Date(a.date) - new Date(b.date);
            return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
        });

        let balance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const ledger = transactions.map((t) => {
            totalDebit += t.debit;
            totalCredit += t.credit;
            balance += t.debit - t.credit;
            return {
                ...t,
                runningBalance: Number(balance.toFixed(2)),
            };
        });

        const totalSales = Number(sales.reduce((s, i) => s + Number(i.totalAmount), 0).toFixed(2));
        const totalReturns = Number(returns.reduce((s, i) => s + Number(i.totalAmount), 0).toFixed(2));
        const totalReceived = Number(cash.reduce((s, i) => s + Number(i.amount), 0).toFixed(2));
        const netPayable = Number((totalSales - totalReturns - totalReceived).toFixed(2));

        res.json({
            customer,
            ledger,
            totalDebit: Number(totalDebit.toFixed(2)),
            totalCredit: Number(totalCredit.toFixed(2)),
            totalSales,
            totalReturns,
            totalReceived,
            finalBalance: netPayable,
            netPayable,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
