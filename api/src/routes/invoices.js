const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected


// Get all Invoices for Lookup
router.get('/invoices', async (req, res) => {
    const {type} = req.query;

    const invoices = await prisma.invoice.findMany({
        // If 'type' is provided, filter by it.
        // If 'type' is missing, filter OUT 'PURCHASE' (so it returns SALES and RETURNS)
        where: type ? {type: type} : {type: {not: 'PURCHASE'}},
        include: {
            customer: true,
            salesman: true,
            town: true,
            items: {include: {product: true}}
        },
        orderBy: {date: 'desc'}
    });
    res.json(invoices);
});

// Get a Single Invoice by ID (for detailed view/printing)
router.get('/invoices/:id', async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: {id: parseInt(req.params.id)},
            include: {
                customer: true,
                salesman: true,
                town: true,
                items: {include: {product: true}}
            }
        });
        if (!invoice) return res.status(404).json({error: "Invoice not found"});
        res.json(invoice);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Create a New Sale/Purchase Invoice
router.post('/invoices', async (req, res) => {
    const {invoiceNo, type, townId, customerId, salesmanId, items} = req.body;

    // Calculate total
    let total = 0;
    let totalDiscount = 0;
    let totalSubTotal = 0;

    const formattedItems = items.map(item => {
        const _item = {
            productId: parseInt(item.productId),
            qty: parseFloat(item.qty),
            rate: parseFloat(item.rate),
            subTotal: parseFloat(item.qty) * parseFloat(item.rate),
            discount: item.discount || 0,
            total: parseFloat(item.qty) * parseFloat(item.rate) - parseFloat(item.discount),
        };

        total += (_item.qty * _item.rate) - (_item.discount || 0);
        totalDiscount += _item.discount;
        totalSubTotal += _item.subTotal;
        return _item;
    });

    try {
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNo,
                type, // "SALE" or "PURCHASE"
                townId: parseInt(townId),
                customerId: customerId ? parseInt(customerId) : null,
                salesmanId: salesmanId ? parseInt(salesmanId) : null,
                totalDiscount: totalDiscount,
                totalSubTotal: totalSubTotal,
                totalAmount: total,
                items: {
                    create: formattedItems
                }
            }
        });
        res.json(invoice);
    } catch (error) {
        console.log(error);
        if (error.code === 'P2002') {
            return res.status(409).json({message: "Invoice number already exists"});
        }
        return res.status(500).json({message: "Failed to create invoice"});
    }
});

module.exports = router;