const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { requireFields, parseId, httpError } = require('../utils/validate');

const router = express.Router();
router.use(authenticateToken);

async function nextReturnNo(tx, date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const prefix = `RET-${y}${m}${d}-`;
    const latest = await tx.invoice.findFirst({
        where: { type: 'RETURN', invoiceNo: { startsWith: prefix } },
        orderBy: { invoiceNo: 'desc' },
        select: { invoiceNo: true },
    });
    let seq = 1;
    if (latest?.invoiceNo) {
        const n = parseInt(latest.invoiceNo.slice(prefix.length), 10);
        if (Number.isFinite(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
}

async function getReturnableLines(saleId) {
    const sale = await prisma.invoice.findUnique({
        where: { id: saleId },
        include: {
            customer: true,
            town: true,
            items: { include: { product: true } },
            returns: {
                where: { type: 'RETURN' },
                include: { items: true },
            },
        },
    });
    if (!sale || sale.type !== 'SALE') return null;

    const returnedByProduct = new Map();
    for (const ret of sale.returns) {
        for (const item of ret.items) {
            const pid = item.productId;
            returnedByProduct.set(pid, (returnedByProduct.get(pid) || 0) + Number(item.qty));
        }
    }

    // Aggregate sale lines by product (same product may appear more than once)
    const soldByProduct = new Map();
    for (const item of sale.items) {
        const pid = item.productId;
        const qty = Number(item.qty);
        const costRate = Number(item.costRate || 0);
        const existing = soldByProduct.get(pid) || {
            productId: pid,
            product: item.product,
            soldQty: 0,
            costQtyTotal: 0,
            rate: Number(item.rate),
            lastSRate:
                item.product?.lastSRate != null
                    ? Number(item.product.lastSRate)
                    : Number(item.rate),
        };
        existing.soldQty += qty;
        existing.costQtyTotal += qty * costRate;
        // Prefer the latest line rate on the sale
        existing.rate = Number(item.rate);
        soldByProduct.set(pid, existing);
    }

    const lines = [...soldByProduct.values()].map((line) => {
        const alreadyReturned = returnedByProduct.get(line.productId) || 0;
        const returnableQty = Number(Math.max(0, line.soldQty - alreadyReturned).toFixed(4));
        const costRate =
            line.soldQty > 0
                ? Number((line.costQtyTotal / line.soldQty).toFixed(2))
                : Number(line.product?.lastPRate || 0);
        return {
            productId: line.productId,
            productName: line.product?.name || `Product #${line.productId}`,
            soldQty: Number(line.soldQty.toFixed(4)),
            alreadyReturned: Number(alreadyReturned.toFixed(4)),
            returnableQty,
            rate: line.rate,
            costRate,
            lastSRate: line.lastSRate,
        };
    });

    return { sale, lines };
}

// Recent returns history
router.get('/returns', async (req, res, next) => {
    try {
        const take = Math.min(parseInt(req.query.limit, 10) || 30, 100);
        const returns = await prisma.invoice.findMany({
            where: { type: 'RETURN' },
            include: {
                customer: true,
                town: true,
                sourceInvoice: { select: { id: true, invoiceNo: true } },
                items: { include: { product: true } },
                payments: { where: { type: 'PAID' } },
            },
            orderBy: { date: 'desc' },
            take,
        });

        res.json(
            returns.map((r) => ({
                id: r.id,
                invoiceNo: r.invoiceNo,
                date: r.date,
                customer: r.customer,
                town: r.town,
                sourceInvoice: r.sourceInvoice,
                totalAmount: Number(r.totalAmount),
                itemCount: r.items.length,
                cashRefunded: r.payments.reduce((s, p) => s + Number(p.amount), 0) > 0,
            }))
        );
    } catch (error) {
        next(error);
    }
});

// SALE invoices available for return (search)
router.get('/returns/sales', async (req, res, next) => {
    try {
        const q = (req.query.q || '').trim();
        const take = Math.min(parseInt(req.query.limit, 10) || 25, 50);

        const where = { type: 'SALE' };
        if (q) {
            where.OR = [
                { invoiceNo: { contains: q, mode: 'insensitive' } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
                { customer: { phone: { contains: q, mode: 'insensitive' } } },
            ];
        }

        const sales = await prisma.invoice.findMany({
            where,
            include: {
                customer: true,
                town: true,
                items: { select: { qty: true } },
            },
            orderBy: { date: 'desc' },
            take,
        });

        res.json(
            sales.map((s) => ({
                id: s.id,
                invoiceNo: s.invoiceNo,
                date: s.date,
                customerId: s.customerId,
                customerName: s.customer?.name || null,
                phone: s.customer?.phone || null,
                townId: s.townId,
                townName: s.town?.name || null,
                totalAmount: Number(s.totalAmount),
                itemCount: s.items.length,
            }))
        );
    } catch (error) {
        next(error);
    }
});

// Returnable lines for a SALE
router.get('/returns/sales/:id', async (req, res, next) => {
    try {
        const saleId = parseId(req.params.id, 'sale id');
        const data = await getReturnableLines(saleId);
        if (!data) throw httpError(404, 'Sale invoice not found');

        const { sale, lines } = data;
        res.json({
            id: sale.id,
            invoiceNo: sale.invoiceNo,
            date: sale.date,
            townId: sale.townId,
            town: sale.town,
            customerId: sale.customerId,
            customer: sale.customer,
            totalAmount: Number(sale.totalAmount),
            lines,
            hasReturnable: lines.some((l) => l.returnableQty > 0),
        });
    } catch (error) {
        next(error);
    }
});

// Process a Stock Return against a SALE
router.post('/returns', async (req, res, next) => {
    try {
        const { date, items, sourceInvoiceId } = req.body;
        const refundCash = Boolean(req.body.refundCash);

        requireFields(req.body, ['sourceInvoiceId']);
        if (!Array.isArray(items) || items.length === 0) {
            throw httpError(400, 'At least one item is required');
        }

        const saleId = parseId(sourceInvoiceId, 'sourceInvoiceId');
        const returnable = await getReturnableLines(saleId);
        if (!returnable) throw httpError(404, 'Sale invoice not found');

        const { sale, lines } = returnable;
        if (!sale.customerId) {
            throw httpError(400, 'Cannot return a sale without a customer');
        }

        const returnableMap = new Map(lines.map((l) => [l.productId, l]));
        let totalRefund = 0;

        const formattedItems = items.map((item) => {
            const productId = parseId(item.productId, 'productId');
            const qty = parseFloat(item.qty);
            const rate = parseFloat(item.rate);
            const info = returnableMap.get(productId);

            if (!info) {
                throw httpError(400, `Product #${productId} was not on the selected sale`);
            }
            if (!Number.isFinite(qty) || qty <= 0) {
                throw httpError(400, `Invalid qty for ${info.productName}`);
            }
            if (qty > info.returnableQty + 0.0001) {
                throw httpError(
                    400,
                    `Cannot return ${qty} of "${info.productName}". Returnable: ${info.returnableQty}`
                );
            }
            if (!Number.isFinite(rate) || rate < 0) {
                throw httpError(400, `Invalid rate for ${info.productName}`);
            }

            const subTotal = qty * rate;
            const lineTotal = subTotal;
            totalRefund += lineTotal;

            return {
                productId,
                qty,
                rate,
                costRate: Number(info.costRate || 0),
                discount: 0,
                subTotal,
                total: lineTotal,
            };
        });

        // Aggregate duplicate product lines before final qty check
        const qtyByProduct = new Map();
        for (const item of formattedItems) {
            qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.qty);
        }
        for (const [productId, qty] of qtyByProduct) {
            const info = returnableMap.get(productId);
            if (qty > info.returnableQty + 0.0001) {
                throw httpError(
                    400,
                    `Cannot return ${qty} of "${info.productName}". Returnable: ${info.returnableQty}`
                );
            }
        }

        const returnDate = date ? new Date(date) : new Date();
        if (Number.isNaN(returnDate.getTime())) {
            throw httpError(400, 'Invalid date');
        }

        const result = await prisma.$transaction(async (tx) => {
            const invoiceNo =
                req.body.invoiceNo && String(req.body.invoiceNo).trim()
                    ? String(req.body.invoiceNo).trim()
                    : await nextReturnNo(tx, returnDate);

            const returnInvoice = await tx.invoice.create({
                data: {
                    invoiceNo,
                    type: 'RETURN',
                    townId: sale.townId,
                    customerId: sale.customerId,
                    sourceInvoiceId: sale.id,
                    totalAmount: totalRefund,
                    totalSubTotal: formattedItems.reduce((s, i) => s + i.subTotal, 0),
                    totalDiscount: 0,
                    date: returnDate,
                    items: {
                        create: formattedItems,
                    },
                },
                include: {
                    customer: true,
                    town: true,
                    sourceInvoice: { select: { id: true, invoiceNo: true } },
                    items: { include: { product: true } },
                },
            });

            let cashRecord = null;
            if (refundCash && totalRefund > 0) {
                cashRecord = await tx.cashRecord.create({
                    data: {
                        date: returnDate,
                        type: 'PAID',
                        customerId: sale.customerId,
                        amount: totalRefund,
                        note: `Refund for Return ${invoiceNo} (Sale #${sale.invoiceNo})`,
                        invoiceId: returnInvoice.id,
                    },
                });
            }

            return { returnInvoice, cashRecord };
        });

        res.status(201).json({
            message: refundCash
                ? 'Return processed. Stock restored and cash refund recorded.'
                : 'Return processed. Stock restored and customer account credited.',
            returnInvoice: result.returnInvoice,
            cashRecord: result.cashRecord,
            refundCash,
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Return invoice number already exists' });
        }
        next(error);
    }
});

module.exports = router;
