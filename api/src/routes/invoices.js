const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { ADMIN_ROLES, hasRole } = require('../roles');
const { assertSufficientStock } = require('../utils/stock');
const { PAYMENT_STATUS, recomputeInvoicePayment } = require('../utils/payments');
const { httpError, nonNegativeNumber, parseId } = require('../utils/validate');
const { summarizeInvoiceProfit } = require('../utils/profit');

const router = express.Router();
router.use(authenticateToken);

// Invoice lookup (paginated + server search/filters)
// Query: page, pageSize, q, type, paymentStatus, from, to
router.get('/invoices', async (req, res, next) => {
    try {
        const {
            type,
            q,
            paymentStatus,
            from,
            to,
        } = req.query;

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
        const skip = (page - 1) * pageSize;

        const where = {};

        if (type && type !== 'all') {
            where.type = String(type);
        } else {
            // Default lookup excludes purchases (use type=PURCHASE for purchase lookup)
            where.type = { not: 'PURCHASE' };
        }

        if (paymentStatus && paymentStatus !== 'all') {
            // Payment status only applies to sales
            where.paymentStatus = String(paymentStatus);
            where.type = 'SALE';
        }

        if (from || to) {
            where.date = {};
            if (from) {
                const start = new Date(from);
                if (Number.isNaN(start.getTime())) {
                    throw httpError(400, 'Invalid from date');
                }
                start.setHours(0, 0, 0, 0);
                where.date.gte = start;
            }
            if (to) {
                const end = new Date(to);
                if (Number.isNaN(end.getTime())) {
                    throw httpError(400, 'Invalid to date');
                }
                end.setHours(23, 59, 59, 999);
                where.date.lte = end;
            }
        }

        const search = typeof q === 'string' ? q.trim() : '';
        if (search) {
            where.OR = [
                { invoiceNo: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { town: { name: { contains: search, mode: 'insensitive' } } },
                { company: { name: { contains: search, mode: 'insensitive' } } },
                { salesman: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [total, rows, amountAgg] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    salesman: { select: { id: true, name: true } },
                    town: { select: { id: true, name: true } },
                    company: { select: { id: true, name: true, phone: true } },
                    _count: { select: { items: true } },
                },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                skip,
                take: pageSize,
            }),
            prisma.invoice.aggregate({
                where,
                _sum: { totalAmount: true },
            }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        res.json({
            items: rows.map((inv) => ({
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                type: inv.type,
                paymentStatus: inv.paymentStatus,
                totalAmount: Number(inv.totalAmount),
                customer: inv.customer,
                salesman: inv.salesman,
                town: inv.town,
                company: inv.company,
                itemCount: inv._count?.items ?? 0,
            })),
            page,
            pageSize,
            total,
            totalPages,
            totalAmount: Number(amountAgg._sum.totalAmount || 0),
        });
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
                items: {
                    include: {
                        product: {
                            include: { company: { select: { id: true, name: true } } },
                        },
                    },
                },
                sourceInvoice: { select: { id: true, invoiceNo: true } },
                payments: {
                    orderBy: { date: 'asc' },
                },
            },
        });
        if (!invoice) throw httpError(404, 'Invoice not found');

        const receivedPayments = (invoice.payments || []).filter((p) => p.type === 'RECEIVED');
        const paidAmount = receivedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const profit = ['SALE', 'RETURN'].includes(invoice.type)
            ? summarizeInvoiceProfit(invoice)
            : null;

        res.json({
            ...invoice,
            items: profit ? profit.items : invoice.items,
            paidAmount,
            balanceDue: Number((Number(invoice.totalAmount) - paidAmount).toFixed(2)),
            profit: profit
                ? {
                      netSales: profit.netSales,
                      totalCost: profit.totalCost,
                      grossProfit: profit.grossProfit,
                      signedProfit: profit.signedProfit,
                      marginPct: profit.marginPct,
                  }
                : null,
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

        // Snapshot purchase cost onto SALE lines (PURCHASE costRate stays 0)
        if (type === 'SALE') {
            const productIds = [...new Set(formattedItems.map((i) => i.productId))];
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, lastPRate: true },
            });
            const costMap = new Map(
                products.map((p) => [p.id, Number(p.lastPRate || 0)])
            );
            for (const item of formattedItems) {
                item.costRate = costMap.get(item.productId) || 0;
            }
        } else {
            for (const item of formattedItems) {
                item.costRate = 0;
            }
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
