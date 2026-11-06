const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// --- CUSTOMER LEDGER ---
router.get('/customers/:id/ledger', async (req, res) => {
    const customerId = parseInt(req.params.id);

    try {
        // Get all Sales for this customer
        const sales = await prisma.invoice.findMany({
            where: {customerId, type: 'SALE'},
            orderBy: {date: 'asc'}
        });

        // Get all Cash Received from this customer
        const cash = await prisma.cashRecord.findMany({
            where: {customerId, type: 'RECEIVED'},
            orderBy: {date: 'asc'}
        });

        // Get Customer info
        const customer = await prisma.customer.findUnique({
            where: {id: customerId},
            include: {town: true}
        });

        // Combine and sort all transactions by date
        const transactions = [
            ...sales.map(s => ({date: s.date, type: 'SALE (Debit)', ref: s.invoiceNo, amount: s.totalAmount})),
            ...cash.map(c => ({date: c.date, type: 'CASH (Credit)', ref: c.note || '-', amount: c.amount}))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance and totals
        let balance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const ledger = transactions.map(t => {
            if (t.type.includes('SALE')) {
                totalDebit += t.amount;
                balance += t.amount;
            } else {
                totalCredit += t.amount;
                balance -= t.amount;
            }
            return {...t, runningBalance: balance};
        });

        res.json({customer, ledger, totalDebit, totalCredit, finalBalance: balance});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;