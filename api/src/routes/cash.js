const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { PAYMENT_STATUS, recomputeInvoicePayment } = require('../utils/payments');
const { requireFields, parseId, positiveNumber, httpError } = require('../utils/validate');

const router = express.Router();
router.use(authenticateToken);

async function assertSaleInvoiceForCustomer(invoiceId, customerId) {
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
    return invoice;
}

async function assertPaymentWithinInvoiceTotal(tx, invoiceId, amount, excludeCashId = null) {
    const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { totalAmount: true, invoiceNo: true },
    });
    if (!invoice) throw httpError(400, 'Invoice not found');

    const where = { invoiceId, type: 'RECEIVED' };
    if (excludeCashId) where.id = { not: excludeCashId };

    const paidAgg = await tx.cashRecord.aggregate({
        _sum: { amount: true },
        where,
    });
    const otherPaid = Number(paidAgg._sum.amount || 0);
    const total = Number(invoice.totalAmount);
    if (otherPaid + Number(amount) > total + 0.001) {
        throw httpError(
            400,
            `Payment would exceed invoice #${invoice.invoiceNo} total (already paid ${otherPaid}, balance ${Number((total - otherPaid).toFixed(2))})`
        );
    }
}

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
            await assertSaleInvoiceForCustomer(invoiceId, customerId);
        }

        const result = await prisma.$transaction(async (tx) => {
            if (invoiceId) {
                await assertPaymentWithinInvoiceTotal(tx, invoiceId, amount);
            }

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

            if (invoiceId) {
                await recomputeInvoicePayment(tx, invoiceId);
            }

            return record;
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Paginated cash received list
// Query: page, pageSize, q, from, to
router.get('/cash', async (req, res, next) => {
    try {
        const { q, from, to } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
        const skip = (page - 1) * pageSize;

        const where = { type: 'RECEIVED' };

        if (from || to) {
            where.date = {};
            if (from) {
                const start = new Date(from);
                if (Number.isNaN(start.getTime())) throw httpError(400, 'Invalid from date');
                start.setHours(0, 0, 0, 0);
                where.date.gte = start;
            }
            if (to) {
                const end = new Date(to);
                if (Number.isNaN(end.getTime())) throw httpError(400, 'Invalid to date');
                end.setHours(23, 59, 59, 999);
                where.date.lte = end;
            }
        }

        const search = typeof q === 'string' ? q.trim() : '';
        if (search) {
            where.OR = [
                { note: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { invoice: { invoiceNo: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [total, rows, amountAgg] = await Promise.all([
            prisma.cashRecord.count({ where }),
            prisma.cashRecord.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true, townId: true } },
                    invoice: { select: { id: true, invoiceNo: true, type: true } },
                },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                skip,
                take: pageSize,
            }),
            prisma.cashRecord.aggregate({
                where,
                _sum: { amount: true },
            }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        res.json({
            items: rows.map((r) => ({
                ...r,
                amount: Number(r.amount),
                linkedToInvoice: Boolean(r.invoiceId),
            })),
            page,
            pageSize,
            total,
            totalPages,
            totalAmount: Number(amountAgg._sum.amount || 0),
        });
    } catch (err) {
        next(err);
    }
});

// Update an unlinked cash received entry (invoice-linked rows are read-only)
router.put('/cash/:id', async (req, res, next) => {
    try {
        const id = parseId(req.params.id, 'cash id');
        const existing = await prisma.cashRecord.findUnique({
            where: { id },
            include: { invoice: { select: { id: true, invoiceNo: true } } },
        });
        if (!existing) throw httpError(404, 'Cash record not found');
        if (existing.type !== 'RECEIVED') {
            throw httpError(400, 'Only cash received records can be edited here');
        }
        if (existing.invoiceId) {
            throw httpError(
                400,
                `This payment is linked to invoice #${existing.invoice?.invoiceNo || existing.invoiceId} and cannot be edited. Edit the invoice instead, or delete this payment.`
            );
        }

        requireFields(req.body, ['customerId', 'amount']);
        const customerId = parseId(req.body.customerId, 'customerId');
        const amount = positiveNumber(req.body.amount, 'amount');
        const note = req.body.note || null;
        const date = req.body.date ? new Date(req.body.date) : existing.date;
        if (Number.isNaN(date.getTime())) {
            throw httpError(400, 'Invalid date');
        }

        // Editing stays unallocated — do not allow attaching an invoice via edit
        if (req.body.invoiceId) {
            throw httpError(
                400,
                'Cannot link an invoice while editing. Create a new cash entry to allocate to an invoice.'
            );
        }

        const record = await prisma.cashRecord.update({
            where: { id },
            data: {
                date,
                customerId,
                amount,
                note,
                invoiceId: null,
            },
            include: {
                customer: { select: { id: true, name: true, phone: true, townId: true } },
                invoice: { select: { id: true, invoiceNo: true, type: true } },
            },
        });

        res.json({ ...record, amount: Number(record.amount), linkedToInvoice: false });
    } catch (err) {
        next(err);
    }
});

// Bulk delete cash received; recompute payment status for any linked invoices
router.post('/cash/bulk-delete', async (req, res, next) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        if (ids.length === 0) throw httpError(400, 'ids array is required');

        const parsedIds = [...new Set(ids.map((id) => parseId(id, 'cash id')))];

        const result = await prisma.$transaction(async (tx) => {
            const records = await tx.cashRecord.findMany({
                where: { id: { in: parsedIds }, type: 'RECEIVED' },
                select: { id: true, invoiceId: true },
            });
            if (records.length === 0) {
                throw httpError(404, 'No matching cash records found');
            }

            const foundIds = records.map((r) => r.id);
            const invoiceIds = [
                ...new Set(records.map((r) => r.invoiceId).filter(Boolean)),
            ];

            await tx.cashRecord.deleteMany({ where: { id: { in: foundIds } } });

            for (const invoiceId of invoiceIds) {
                await recomputeInvoicePayment(tx, invoiceId);
            }

            return { deleted: foundIds.length, invoiceIds };
        });

        res.json({
            deleted: result.deleted,
            message: `Deleted ${result.deleted} cash record${result.deleted === 1 ? '' : 's'}${
                result.invoiceIds.length
                    ? `; updated ${result.invoiceIds.length} linked invoice${result.invoiceIds.length === 1 ? '' : 's'}`
                    : ''
            }`,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
