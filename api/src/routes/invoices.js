const express = require('express');
const prisma = require('../db');
const { authenticateToken, requireRoles } = require('../midleware/auth');
const { ADMIN_ROLES, hasRole } = require('../roles');
const {
    assertSufficientStock,
    assertSufficientStockForSaleEdit,
    assertSufficientStockForPurchaseEdit,
} = require('../utils/stock');
const { PAYMENT_STATUS, recomputeInvoicePayment } = require('../utils/payments');
const { httpError, nonNegativeNumber, parseId } = require('../utils/validate');
const { summarizeInvoiceProfit } = require('../utils/profit');

function paymentNoteForInvoice(invoiceNo) {
    return `Payment for Invoice #${invoiceNo}`;
}

function isSaleInvoicePayment(record, invoiceNo) {
    if (!record || record.type !== 'RECEIVED') return false;
    const note = String(record.note || '');
    return (
        note === paymentNoteForInvoice(invoiceNo) ||
        note.startsWith('Payment for Invoice #')
    );
}

function formatInvoiceItems(items) {
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
            costRate:
                item.costRate !== undefined && item.costRate !== null && item.costRate !== ''
                    ? Number(item.costRate)
                    : undefined,
        };
    });

    if (formattedItems.some((i) => !i.productId)) {
        throw httpError(400, 'Each item needs a valid productId');
    }

    return {
        formattedItems,
        total: Number(total.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalSubTotal: Number(totalSubTotal.toFixed(2)),
    };
}

async function applyCostRates(type, formattedItems, existingCostByProduct = new Map()) {
    if (type === 'SALE') {
        const productIds = [...new Set(formattedItems.map((i) => i.productId))];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, lastPRate: true },
        });
        const lastPMap = new Map(products.map((p) => [p.id, Number(p.lastPRate || 0)]));
        for (const item of formattedItems) {
            if (item.costRate !== undefined && Number.isFinite(item.costRate)) {
                item.costRate = Number(item.costRate);
            } else if (existingCostByProduct.has(item.productId)) {
                item.costRate = existingCostByProduct.get(item.productId);
            } else {
                item.costRate = lastPMap.get(item.productId) || 0;
            }
        }
    } else {
        for (const item of formattedItems) {
            item.costRate = 0;
        }
    }
    return formattedItems;
}

/**
 * Sync the on-invoice RECEIVED cash row for a SALE (create/update/delete).
 * Leaves later Cash Received entries untouched.
 */
async function syncSaleInvoicePayment(tx, {
    invoiceId,
    invoiceNo,
    previousInvoiceNo,
    customerId,
    invoiceDate,
    amountReceived,
}) {
    const payments = await tx.cashRecord.findMany({
        where: { invoiceId, type: 'RECEIVED' },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });

    let primary =
        payments.find((p) => isSaleInvoicePayment(p, invoiceNo)) ||
        (previousInvoiceNo && previousInvoiceNo !== invoiceNo
            ? payments.find((p) => isSaleInvoicePayment(p, previousInvoiceNo))
            : null) ||
        null;

    // Backward-compat: if exactly one RECEIVED payment exists, treat it as the invoice payment
    if (!primary && payments.length === 1) {
        primary = payments[0];
    }

    const amount = Number(amountReceived) || 0;

    if (amount > 0) {
        if (!customerId) {
            throw httpError(400, 'customerId is required when amountReceived is set');
        }
        const data = {
            date: invoiceDate,
            type: 'RECEIVED',
            customerId,
            amount,
            note: paymentNoteForInvoice(invoiceNo),
            invoiceId,
        };
        if (primary) {
            await tx.cashRecord.update({ where: { id: primary.id }, data });
        } else {
            await tx.cashRecord.create({ data });
        }
    } else if (primary) {
        await tx.cashRecord.delete({ where: { id: primary.id } });
    }

    await recomputeInvoicePayment(tx, invoiceId);
}

const router = express.Router();
router.use(authenticateToken);

/** Delete invoice + items + cash; child RETURNS first when deleting a SALE. */
async function deleteInvoiceCascade(tx, invoiceId) {
    const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
            id: true,
            invoiceNo: true,
            type: true,
            returns: { select: { id: true } },
        },
    });
    if (!invoice) return null;

    for (const ret of invoice.returns || []) {
        await deleteInvoiceCascade(tx, ret.id);
    }

    await tx.cashRecord.deleteMany({ where: { invoiceId } });
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await tx.invoice.delete({ where: { id: invoiceId } });
    return invoice;
}

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

// Bulk delete invoices (Admin only). Cascades items, cash, and related returns.
router.post('/invoices/bulk-delete', requireRoles(...ADMIN_ROLES), async (req, res, next) => {
    try {
        const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const ids = [...new Set(rawIds.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))];

        if (ids.length === 0) {
            throw httpError(400, 'Select at least one invoice to delete');
        }
        if (ids.length > 100) {
            throw httpError(400, 'You can delete at most 100 invoices at a time');
        }

        const result = await prisma.$transaction(async (tx) => {
            const deleted = [];
            const missing = [];

            // Prefer deleting RETURNS before SALES when both are selected
            const existing = await tx.invoice.findMany({
                where: { id: { in: ids } },
                select: { id: true, invoiceNo: true, type: true },
            });
            const foundIds = new Set(existing.map((i) => i.id));
            for (const id of ids) {
                if (!foundIds.has(id)) missing.push(id);
            }

            const ordered = [
                ...existing.filter((i) => i.type === 'RETURN'),
                ...existing.filter((i) => i.type !== 'RETURN'),
            ];

            for (const inv of ordered) {
                // May already be removed as a child return of a deleted SALE
                const stillThere = await tx.invoice.findUnique({
                    where: { id: inv.id },
                    select: { id: true },
                });
                if (!stillThere) continue;
                const removed = await deleteInvoiceCascade(tx, inv.id);
                if (removed) {
                    deleted.push({
                        id: removed.id,
                        invoiceNo: removed.invoiceNo,
                        type: removed.type,
                    });
                }
            }

            return { deleted, missing };
        });

        res.json({
            message: `Deleted ${result.deleted.length} invoice(s)`,
            deletedCount: result.deleted.length,
            deleted: result.deleted,
            missingIds: result.missing,
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

// Update an existing SALE or PURCHASE invoice (+ sync on-invoice cash for sales)
router.put('/invoices/:id', async (req, res, next) => {
    try {
        const id = parseId(req.params.id, 'invoice id');
        const existing = await prisma.invoice.findUnique({
            where: { id },
            include: {
                items: true,
                payments: { orderBy: [{ date: 'asc' }, { id: 'asc' }] },
                returns: {
                    where: { type: 'RETURN' },
                    include: { items: true },
                },
            },
        });
        if (!existing) throw httpError(404, 'Invoice not found');
        if (!['SALE', 'PURCHASE'].includes(existing.type)) {
            throw httpError(400, 'Only SALE and PURCHASE invoices can be edited');
        }
        if (existing.type === 'PURCHASE' && !hasRole(req.user, ADMIN_ROLES)) {
            throw httpError(403, 'Insufficient permissions to edit purchases');
        }

        const {
            invoiceNo,
            townId,
            customerId,
            salesmanId,
            companyId,
            date,
            items,
            amountReceived,
        } = req.body;

        if (!invoiceNo?.trim() || !townId) {
            throw httpError(400, 'invoiceNo and townId are required');
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw httpError(400, 'At least one item is required');
        }
        if (existing.type === 'PURCHASE' && !companyId) {
            throw httpError(400, 'companyId (supplier) is required for purchases');
        }
        if (existing.type === 'SALE' && !customerId) {
            throw httpError(400, 'customerId is required for sales');
        }

        const { formattedItems, total, totalDiscount, totalSubTotal } =
            formatInvoiceItems(items);

        const existingCostByProduct = new Map();
        for (const line of existing.items) {
            if (!existingCostByProduct.has(line.productId)) {
                existingCostByProduct.set(line.productId, Number(line.costRate || 0));
            }
        }
        await applyCostRates(existing.type, formattedItems, existingCostByProduct);

        // SALE: new qty per product cannot drop below already-returned qty
        if (existing.type === 'SALE' && existing.returns?.length) {
            const returnedByProduct = new Map();
            for (const ret of existing.returns) {
                for (const line of ret.items || []) {
                    const pid = line.productId;
                    returnedByProduct.set(
                        pid,
                        (returnedByProduct.get(pid) || 0) + Number(line.qty || 0)
                    );
                }
            }
            const newQtyByProduct = new Map();
            for (const item of formattedItems) {
                newQtyByProduct.set(
                    item.productId,
                    (newQtyByProduct.get(item.productId) || 0) + item.qty
                );
            }
            for (const [productId, returnedQty] of returnedByProduct) {
                const newQty = newQtyByProduct.get(productId) || 0;
                if (newQty + 0.0001 < returnedQty) {
                    throw httpError(
                        400,
                        `Cannot reduce product #${productId} below returned qty (${returnedQty})`
                    );
                }
            }
        }

        const parsedTownId = parseId(townId, 'townId');
        const parsedCustomerId = customerId ? parseId(customerId, 'customerId') : null;
        const parsedSalesmanId = salesmanId ? parseId(salesmanId, 'salesmanId') : null;
        const parsedCompanyId = companyId ? parseId(companyId, 'companyId') : null;
        const nextInvoiceNo = String(invoiceNo).trim();

        let invoiceDate = existing.date;
        if (date) {
            invoiceDate = new Date(date);
            if (Number.isNaN(invoiceDate.getTime())) {
                throw httpError(400, 'Invalid date');
            }
        }

        // Other RECEIVED payments (from Cash Received) stay; invoice payment is separate
        let otherPaid = 0;
        if (existing.type === 'SALE') {
            const primary =
                existing.payments.find((p) => isSaleInvoicePayment(p, existing.invoiceNo)) ||
                (existing.payments.filter((p) => p.type === 'RECEIVED').length === 1
                    ? existing.payments.find((p) => p.type === 'RECEIVED')
                    : null);
            otherPaid = existing.payments
                .filter((p) => p.type === 'RECEIVED' && (!primary || p.id !== primary.id))
                .reduce((s, p) => s + Number(p.amount || 0), 0);
        }

        const received =
            amountReceived !== undefined && amountReceived !== null && amountReceived !== ''
                ? nonNegativeNumber(amountReceived, 'amountReceived')
                : existing.type === 'SALE'
                  ? (() => {
                        const primary =
                            existing.payments.find((p) =>
                                isSaleInvoicePayment(p, existing.invoiceNo)
                            ) ||
                            (existing.payments.filter((p) => p.type === 'RECEIVED').length === 1
                                ? existing.payments.find((p) => p.type === 'RECEIVED')
                                : null);
                        return primary ? Number(primary.amount || 0) : 0;
                    })()
                  : 0;

        if (existing.type === 'SALE' && received + otherPaid > total + 0.001) {
            throw httpError(
                400,
                `Total payments (invoice ${received} + other ${otherPaid}) cannot exceed invoice total ${total}`
            );
        }

        if (existing.type === 'SALE') {
            await assertSufficientStockForSaleEdit(prisma, formattedItems, id);
        } else if (existing.type === 'PURCHASE') {
            await assertSufficientStockForPurchaseEdit(prisma, formattedItems, id);
        }

        if (existing.type === 'PURCHASE' && parsedCompanyId) {
            const company = await prisma.company.findUnique({
                where: { id: parsedCompanyId },
                select: { id: true, isActive: true },
            });
            if (!company || !company.isActive) {
                throw httpError(400, 'Supplier company not found or inactive');
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

            await tx.invoice.update({
                where: { id },
                data: {
                    invoiceNo: nextInvoiceNo,
                    date: invoiceDate,
                    townId: parsedTownId,
                    customerId: existing.type === 'SALE' ? parsedCustomerId : null,
                    salesmanId: existing.type === 'SALE' ? parsedSalesmanId : null,
                    companyId: existing.type === 'PURCHASE' ? parsedCompanyId : null,
                    totalDiscount,
                    totalSubTotal,
                    totalAmount: total,
                    items: { create: formattedItems },
                },
            });

            const rateField = existing.type === 'PURCHASE' ? 'lastPRate' : 'lastSRate';
            for (const item of formattedItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { [rateField]: item.rate },
                });
            }

            if (existing.type === 'SALE') {
                // Keep later Cash Received rows on this invoice; refresh customer if changed
                await tx.cashRecord.updateMany({
                    where: { invoiceId: id, type: 'RECEIVED' },
                    data: { customerId: parsedCustomerId },
                });

                await syncSaleInvoicePayment(tx, {
                    invoiceId: id,
                    invoiceNo: nextInvoiceNo,
                    previousInvoiceNo: existing.invoiceNo,
                    customerId: parsedCustomerId,
                    invoiceDate,
                    amountReceived: received,
                });
            }

            return tx.invoice.findUnique({
                where: { id },
                include: {
                    customer: true,
                    company: true,
                    town: true,
                    salesman: true,
                    items: { include: { product: true } },
                    payments: { orderBy: { date: 'asc' } },
                },
            });
        });

        const receivedPayments = (updated.payments || []).filter((p) => p.type === 'RECEIVED');
        const paidAmount = receivedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        res.json({
            ...updated,
            paidAmount,
            balanceDue: Number((Number(updated.totalAmount) - paidAmount).toFixed(2)),
        });
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
            return res.status(409).json({
                error: 'Invoice number already exists',
                message: 'Invoice number already exists',
            });
        }
        next(err);
    }
});

module.exports = router;
