const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Process a Stock Return (invoice + optional cash payout in one transaction)
router.post('/returns', async (req, res) => {
    const { invoiceNo, date, townId, customerId, items, refundCash = true } = req.body;

    if (!invoiceNo || !townId) {
        return res.status(400).json({ error: 'invoiceNo and townId are required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
    }

    try {
        let totalRefund = 0;
        const formattedItems = items.map((item) => {
            const qty = parseFloat(item.qty);
            const rate = parseFloat(item.rate);
            const discount = parseFloat(item.discount) || 0;
            const subTotal = qty * rate;
            const lineTotal = subTotal - discount;
            totalRefund += lineTotal;
            return {
                productId: parseInt(item.productId),
                qty,
                rate,
                discount,
                subTotal,
                total: lineTotal,
            };
        });

        if (formattedItems.some((i) => !i.productId || !(i.qty > 0))) {
            return res.status(400).json({ error: 'Each item needs a valid productId and qty > 0' });
        }

        const parsedCustomerId = customerId ? parseInt(customerId) : null;
        const returnDate = date ? new Date(date) : new Date();

        const result = await prisma.$transaction(async (tx) => {
            const returnInvoice = await tx.invoice.create({
                data: {
                    invoiceNo,
                    type: 'RETURN',
                    townId: parseInt(townId),
                    customerId: parsedCustomerId,
                    totalAmount: totalRefund,
                    totalSubTotal: formattedItems.reduce((s, i) => s + i.subTotal, 0),
                    totalDiscount: formattedItems.reduce((s, i) => s + i.discount, 0),
                    date: returnDate,
                    items: {
                        create: formattedItems,
                    },
                },
            });

            // Cash leaving the till (PAID). AR is already reduced by the RETURN invoice.
            let cashRecord = null;
            if (refundCash && parsedCustomerId && totalRefund > 0) {
                cashRecord = await tx.cashRecord.create({
                    data: {
                        date: returnDate,
                        type: 'PAID',
                        customerId: parsedCustomerId,
                        amount: totalRefund,
                        note: `Refund for Return Invoice #${invoiceNo}`,
                        invoiceId: returnInvoice.id,
                    },
                });
            }

            return { returnInvoice, cashRecord };
        });

        res.json({
            message: 'Return processed successfully',
            returnInvoice: result.returnInvoice,
            cashRecord: result.cashRecord,
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Return invoice number already exists' });
        }
        res.status(500).json({ error: 'Failed to process return' });
    }
});

module.exports = router;
