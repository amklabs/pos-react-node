const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { ADMIN_ROLES, hasRole } = require('../roles');
const { assertSufficientStock } = require('../utils/stock');
const { PAYMENT_STATUS, recomputeInvoicePayment } = require('../utils/payments');
const { httpError, nonNegativeNumber, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticateToken);

// Get all Invoices for Lookup
router.get('/invoices', async (req, res, next) => {
    try {
        const { type } = req.query;
        const invoices = await prisma.invoice.findMany({
            where: type ? { type } : { type: { not: 'PURCHASE' } },
            include: {
                customer: true,
                salesman: true,
                town: true,
                company: true,
                items: { include: { product: true } },
            },
            orderBy: { date: 'desc' },
        });
        res.json(invoices);
    } catch (err) {
        next(err);
    }
});

// Get a Single Invoice by ID (for detailed view/printing)
router.get('/invoices/:id', async (req, res, next) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: parseId(req.params.id, 'invoice id') },
            include: {
                customer: true,
                salesman: true,
                town: true,
                company: true,
                items: { include: { product: true } },
                sourceInvoice: { select: { id: true, invoiceNo: true } },
                payments: {
                    orderBy: { date: 'asc' },
                },
            },
        });
        if (!invoice) throw httpError(404, 'Invoice not found');

        const receivedPayments = (invoice.payments || []).filter((p) => p.type === 'RECEIVED');
        const paidAmount = receivedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        res.json({
            ...invoice,
            paidAmount,
            balanceDue: Number((Number(invoice.totalAmount) - paidAmount).toFixed(2)),
        });
    } catch (err) {
        next(err);
    }
});

// Create a New Sale/Purchase Invoice
router.post('/invoices', async (req, res, next) => {
    try {
        const { invoiceNo, type, townId, customerId, salesmanId, companyId, date, items, amountReceived } = req.body;

        if (!invoiceNo || !type || !townId) {
            throw httpError(400, 'invoiceNo, type, and townId are required');
        }
        if (!['SALE', 'PURCHASE'].includes(type)) {
            throw httpError(400, 'type must be SALE or PURCHASE');
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw httpError(400, 'At least one item is required');
        }
        if (type === 'PURCHASE' && !hasRole(req.user, ADMIN_ROLES)) {
            throw httpError(403, 'Insufficient permissions to create purchases');
        }
        if (type === 'PURCHASE' && !companyId) {
            throw httpError(400, 'companyId (supplier) is required for purchases');
        }

        let total = 0;
        let totalDiscount = 0;
        let totalSubTotal = 0;

        const formattedItems = items.map((item) => {
            const qty = parseFloat(item.qty);
            const rate = parseFloat(item.rate);
            const discount = parseFloat(item.discount) || 0;
            if (!Number.isFinite(qty) || qty <= 0) {
                throw httpError(400, 'Each item needs qty > 0');
            }
            if (!Number.isFinite(rate) || rate < 0) {
                throw httpError(400, 'Each item needs a valid rate');
            }
            if (!Number.isFinite(discount) || discount < 0) {
                throw httpError(400, 'Discount cannot be negative');
            }
            const subTotal = qty * rate;
            if (discount > subTotal) {
                throw httpError(400, 'Discount cannot exceed line subtotal');
            }
            const lineTotal = subTotal - discount;

            total += lineTotal;
            totalDiscount += discount;
            totalSubTotal += subTotal;

            return {
                productId: parseInt(item.productId, 10),
                qty,
                rate,
                subTotal,
                discount,
                total: lineTotal,
            };
        });

        if (formattedItems.some((i) => !i.productId)) {
            throw httpError(400, 'Each item needs a valid productId');
        }

        const received = amountReceived !== undefined && amountReceived !== null && amountReceived !== ''
            ? nonNegativeNumber(amountReceived, 'amountReceived')
            : 0;

        if (received > 0 && !customerId) {
            throw httpError(400, 'customerId is required when amountReceived is set');
        }
        if (received > total + 0.001) {
            throw httpError(400, 'amountReceived cannot exceed invoice total');
        }

        if (type === 'SALE') {
            await assertSufficientStock(prisma, formattedItems);
        }

        const parsedTownId = parseId(townId, 'townId');
        const parsedCustomerId = customerId ? parseId(customerId, 'customerId') : null;
        const parsedSalesmanId = salesmanId ? parseId(salesmanId, 'salesmanId') : null;
        const parsedCompanyId = companyId ? parseId(companyId, 'companyId') : null;

        let invoiceDate = new Date();
        if (date) {
            invoiceDate = new Date(date);
            if (Number.isNaN(invoiceDate.getTime())) {
                throw httpError(400, 'Invalid date');
            }
        }

        if (type === 'PURCHASE' && parsedCompanyId) {
            const company = await prisma.company.findUnique({
                where: { id: parsedCompanyId },
                select: { id: true, isActive: true },
            });
            if (!company || !company.isActive) {
                throw httpError(400, 'Supplier company not found or inactive');
            }
        }

        const invoice = await prisma.$transaction(async (tx) => {
            const created = await tx.invoice.create({
                data: {
                    invoiceNo,
                    type,
                    date: invoiceDate,
                    townId: parsedTownId,
                    customerId: parsedCustomerId,
                    salesmanId: parsedSalesmanId,
                    companyId: type === 'PURCHASE' ? parsedCompanyId : null,
                    totalDiscount,
                    totalSubTotal,
                    totalAmount: total,
                    paymentStatus: PAYMENT_STATUS.PENDING,
                    items: {
                        create: formattedItems,
                    },
                },
            });

            // Update last rates per product
            const rateField = type === 'PURCHASE' ? 'lastPRate' : 'lastSRate';
            for (const item of formattedItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { [rateField]: item.rate },
                });
            }

            if (type === 'SALE' && received > 0 && parsedCustomerId) {
                await tx.cashRecord.create({
                    data: {
                        date: invoiceDate,
                        type: 'RECEIVED',
                        customerId: parsedCustomerId,
                        amount: received,
                        note: `Payment for Invoice #${invoiceNo}`,
                        invoiceId: created.id,
                    },
                });
                await recomputeInvoicePayment(tx, created.id);
            }

            return tx.invoice.findUnique({
                where: { id: created.id },
                include: {
                    customer: true,
                    company: true,
                    town: true,
                    items: { include: { product: true } },
                    payments: true,
                },
            });
        });

        res.status(201).json(invoice);
    } catch (err) {
        if (err.status === 400 && err.productId) {
            return res.status(400).json({
                error: err.message,
                message: err.message,
                productId: err.productId,
                available: err.available,
                requested: err.requested,
            });
        }
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Invoice number already exists', message: 'Invoice number already exists' });
        }
        next(err);
    }
});

module.exports = router;
