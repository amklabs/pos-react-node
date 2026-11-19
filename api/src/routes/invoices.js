const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');
const { ADMIN_ROLES, hasRole } = require('../roles');
const { assertSufficientStock } = require('../utils/stock');

const router = express.Router();
router.use(authenticateToken);

// Get all Invoices for Lookup
router.get('/invoices', async (req, res) => {
    const { type } = req.query;

    const invoices = await prisma.invoice.findMany({
        where: type ? { type } : { type: { not: 'PURCHASE' } },
        include: {
            customer: true,
            salesman: true,
            town: true,
            items: { include: { product: true } },
        },
        orderBy: { date: 'desc' },
    });
    res.json(invoices);
});

// Get a Single Invoice by ID (for detailed view/printing)
router.get('/invoices/:id', async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                customer: true,
                salesman: true,
                town: true,
                items: { include: { product: true } },
            },
        });
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        res.json(invoice);
    } catch {
        res.status(500).json({ error: 'Failed to load invoice' });
    }
});

// Create a New Sale/Purchase Invoice
router.post('/invoices', async (req, res) => {
    const { invoiceNo, type, townId, customerId, salesmanId, items } = req.body;

    if (!invoiceNo || !type || !townId) {
        return res.status(400).json({ message: 'invoiceNo, type, and townId are required' });
    }
    if (!['SALE', 'PURCHASE'].includes(type)) {
        return res.status(400).json({ message: 'type must be SALE or PURCHASE' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
    }
    if (type === 'PURCHASE' && !hasRole(req.user, ADMIN_ROLES)) {
        return res.status(403).json({ error: 'Insufficient permissions to create purchases' });
    }

    let total = 0;
    let totalDiscount = 0;
    let totalSubTotal = 0;

    const formattedItems = items.map((item) => {
        const qty = parseFloat(item.qty);
        const rate = parseFloat(item.rate);
        const discount = parseFloat(item.discount) || 0;
        const subTotal = qty * rate;
        const lineTotal = subTotal - discount;

        total += lineTotal;
        totalDiscount += discount;
        totalSubTotal += subTotal;

        return {
            productId: parseInt(item.productId),
            qty,
            rate,
            subTotal,
            discount,
            total: lineTotal,
        };
    });

    if (formattedItems.some((i) => !i.productId || !(i.qty > 0))) {
        return res.status(400).json({ message: 'Each item needs a valid productId and qty > 0' });
    }

    try {
        if (type === 'SALE') {
            await assertSufficientStock(prisma, formattedItems);
        }

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNo,
                type,
                townId: parseInt(townId),
                customerId: customerId ? parseInt(customerId) : null,
                salesmanId: salesmanId ? parseInt(salesmanId) : null,
                totalDiscount,
                totalSubTotal,
                totalAmount: total,
                items: {
                    create: formattedItems,
                },
            },
        });
        res.json(invoice);
    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({
                message: error.message,
                productId: error.productId,
                available: error.available,
                requested: error.requested,
            });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ message: 'Invoice number already exists' });
        }
        return res.status(500).json({ message: 'Failed to create invoice' });
    }
});

module.exports = router;
