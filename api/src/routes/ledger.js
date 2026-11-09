const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// --- CUSTOMER LEDGER ---
router.get('/customers/:id/ledger', async (req, res) => {
    const customerIdParam = req.params.id;

    try {
        if (customerIdParam === 'all') {
            // ===== ALL CUSTOMERS MODE =====
            const [sales, cash, customers, returns] = await Promise.all([
                prisma.invoice.findMany({
                    where: {type: 'SALE'},
                    orderBy: {date: 'asc'}
                }),
                prisma.cashRecord.findMany({
                    where: {type: 'RECEIVED'},
                    orderBy: {date: 'asc'}
                }),
                prisma.customer.findMany({
                    include: {town: true}
                }),
                prisma.invoice.findMany({
                    where: {type: 'RETURN'},
                    orderBy: {date: 'asc'}
                }),
            ]);

            const customerMap = new Map(customers.map(c => [c.id, c]));

            // Combine and sort all transactions by date
            const transactions = [
                ...sales.map(s => ({
                    customerId: s.customerId,
                    date: s.date,
                    type: 'SALE (Debit)',
                    ref: s.invoiceNo,
                    amount: s.totalAmount
                })),
                ...cash.map(c => ({
                    customerId: c.customerId,
                    date: c.date,
                    type: 'CASH (Credit)',
                    ref: c.note || '-',
                    amount: c.amount
                })),
                ...returns.map(r => ({
                    customerId: r.customerId,
                    date: r.date,
                    type: 'RETURN (Credit)',
                    ref: r.invoiceNo,
                    amount: r.totalAmount
                }))
            ].sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calculate running balance PER customer
            const perCustomerState = new Map();
            let totalDebit = 0;
            let totalCredit = 0;
            let overallBalance = 0;

            const ledger = transactions.map(t => {
                if (!perCustomerState.has(t.customerId)) {
                    perCustomerState.set(t.customerId, 0);
                }
                let custBalance = perCustomerState.get(t.customerId);
                const amt = parseFloat(t.amount);

                if (t.type.includes('SALE')) {
                    totalDebit += amt;
                    custBalance += amt;
                    overallBalance += amt;
                } else {
                    // CASH and RETURN both credit the customer
                    totalCredit += amt;
                    custBalance -= amt;
                    overallBalance -= amt;
                }

                perCustomerState.set(t.customerId, custBalance);

                const cust = customerMap.get(t.customerId);
                return {
                    ...t,
                    customerName: cust ? cust.name : `#${t.customerId}`,
                    town: cust?.town?.name || null,
                    runningBalance: custBalance
                };
            });

            // Per-customer final balances summary
            const customerBalances = customers.map(c => ({
                customerId: c.id,
                customerName: c.name,
                town: c.town?.name || null,
                finalBalance: perCustomerState.get(c.id) || 0
            }));

            return res.json({
                customer: null,
                customers,
                customerBalances,
                ledger,
                totalDebit,
                totalCredit,
                finalBalance: overallBalance
            });
        }

        // ===== SINGLE CUSTOMER MODE =====
        const customerId = parseInt(customerIdParam);

        const [sales, cash, returns, customer] = await Promise.all([
            prisma.invoice.findMany({
                where: {customerId, type: 'SALE'},
                orderBy: {date: 'asc'}
            }),
            prisma.cashRecord.findMany({
                where: {customerId, type: 'RECEIVED'},
                orderBy: {date: 'asc'}
            }),
            prisma.invoice.findMany({
                where: {customerId, type: 'RETURN'},
                orderBy: {date: 'asc'}
            }),
            prisma.customer.findUnique({
                where: {id: customerId},
                include: {town: true}
            })
        ]);

        // Combine and sort all transactions by date
        const transactions = [
            ...sales.map(s => ({date: s.date, type: 'SALE (Debit)', ref: s.invoiceNo, amount: s.totalAmount})),
            ...cash.map(c => ({date: c.date, type: 'CASH (Credit)', ref: c.note || '-', amount: c.amount})),
            ...returns.map(r => ({date: r.date, type: 'RETURN (Credit)', ref: r.invoiceNo, amount: r.totalAmount}))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance and totals
        let balance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const ledger = transactions.map(t => {
            const amt = parseFloat(t.amount);
            if (t.type.includes('SALE')) {
                totalDebit += amt;
                balance += amt;
            } else {
                // CASH and RETURN both credit the customer
                totalCredit += amt;
                balance -= amt;
            }
            return {...t, runningBalance: balance};
        });

        res.json({customer, ledger, totalDebit, totalCredit, finalBalance: balance});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;