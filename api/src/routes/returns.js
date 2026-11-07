const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// Process a Stock Return
router.post('/returns', async (req, res) => {
    const {invoiceNo, date, townId, customerId, items} = req.body;

    try {
        // 1. Create the Return Invoice
        let totalRefund = 0;
        const formattedItems = items.map(item => {
            const itemTotal = (item.qty * item.rate) - (item.discount || 0);
            totalRefund += itemTotal;
            return {
                productId: parseInt(item.productId),
                qty: parseInt(item.qty),
                rate: parseFloat(item.rate),
                discount: parseFloat(item.discount) || 0
            };
        });

        const returnInvoice = await prisma.invoice.create({
            data: {
                invoiceNo,
                type: 'RETURN', // This is the magic word that adds stock back
                townId: parseInt(townId),
                customerId: customerId ? parseInt(customerId) : null,
                totalAmount: totalRefund, // Refund amount
                date: new Date(date),
                items: {
                    create: formattedItems
                }
            }
        });

        // 2. Automatically record the Cash OUT (Refund)
        if (customerId) {
            await prisma.cashRecord.create({
                data: {
                    date: new Date(date),
                    type: 'REFUND', // Money goes out
                    customerId: parseInt(customerId),
                    amount: totalRefund,
                    note: `Refund for Return Invoice #${invoiceNo}`
                }
            });
        }

        res.json({message: "Return processed successfully", returnInvoice});
    } catch (error) {
        res.status(500).json({error: "Failed to process return", details: error.message});
    }
});

module.exports = router;