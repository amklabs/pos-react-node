const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { PAYMENT_STATUS, recomputeInvoicePayment } = require('../utils/payments');
const { requireFields, parseId, positiveNumber, httpError } = require('../utils/validate');

const router = express.Router();
router.use(authenticateToken);

// Unpaid SALE invoices for a customer (cash allocation picker)
router.get('/customers/:id/unpaid-invoices', async (req, res, next) => {
    try {
        const customerId = parseId(req.params.id, 'customerId');
        const invoices = await prisma.invoice.findMany({
            where: {
                customerId,
                type: 'SALE',
                paymentStatus: { not: PAYMENT_STATUS.PAID },
            },
            include: {
                payments: {
                    where: { type: 'RECEIVED' },
                    select: { amount: true },
                },
            },
            orderBy: { date: 'asc' },
        });

        const result = invoices.map((inv) => {
            const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const total = Number(inv.totalAmount);
            return {
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                totalAmount: total,
                paidAmount: paid,
                balance: Number((total - paid).toFixed(2)),
                paymentStatus: inv.paymentStatus,
            };
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Add a Cash Record (optional invoice link)
router.post('/cash', async (req, res, next) => {
    try {
        requireFields(req.body, ['customerId', 'amount']);
        const customerId = parseId(req.body.customerId, 'customerId');
        const amount = positiveNumber(req.body.amount, 'amount');
        const note = req.body.note || null;
        const date = req.body.date ? new Date(req.body.date) : new Date();
        if (Number.isNaN(date.getTime())) {
            throw httpError(400, 'Invalid date');
        }

        let invoiceId = null;
        if (req.body.invoiceId !== undefined && req.body.invoiceId !== null && req.body.invoiceId !== '') {
            invoiceId = parseId(req.body.invoiceId, 'invoiceId');
            const invoice = await prisma.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, type: true, customerId: true, totalAmount: true },
            });
            if (!invoice || invoice.type !== 'SALE') {
                throw httpError(400, 'invoiceId must reference a SALE invoice');
            }
            if (invoice.customerId !== customerId) {
                throw httpError(400, 'Invoice does not belong to the selected customer');
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const record = await tx.cashRecord.create({
                data: {
                    date,
                    type: 'RECEIVED',
                    customerId,
                    amount,
                    note,
                    invoiceId,
                },
                include: { customer: true, invoice: true },
            });

            let invoice = null;
            if (invoiceId) {
                invoice = await recomputeInvoicePayment(tx, invoiceId);
            }

            return { record, invoice };
        });

        res.json(result.record);
    } catch (err) {
        next(err);
    }
});

// Get all Cash Records
router.get('/cash', async (req, res, next) => {
    try {
        const records = await prisma.cashRecord.findMany({
            include: { customer: true, invoice: true },
            orderBy: { date: 'desc' },
        });
        res.json(records);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
