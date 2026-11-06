const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

router.get('/dashboard', async (req, res) => {
    try {
        // 1. Get today's date range (start of day to end of day)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 2. Today's Sales Total
        const todaySales = await prisma.invoice.aggregate({
            _sum: {totalAmount: true},
            where: {
                type: 'SALE',
                date: {gte: startOfDay, lte: endOfDay}
            }
        });

        // 3. Total Cash In Hand (Received - Refunds)
        const cashRecords = await prisma.cashRecord.findMany();
        const totalCash = cashRecords.reduce((sum, rec) => {
            return rec.type === 'RECEIVED' ? sum + rec.amount : sum - rec.amount;
        }, 0);

        // 4. Total Products Count
        const totalProducts = await prisma.product.count();

        // 5. Low Stock Alerts (Using the logic from our Stock Report)
        const products = await prisma.product.findMany();
        const lowStockItems = [];

        for (const product of products) {
            const purchased = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'PURCHASE'}}
            });
            const sold = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'SALE'}}
            });
            const returned = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'RETURN'}}
            });

            const balance = (purchased._sum.qty || 0) - (sold._sum.qty || 0) + (returned._sum.qty || 0);

            // If stock is less than 10, add to low stock list
            if (balance < 10) {
                lowStockItems.push({name: product.name, balance});
            }
        }

        // Send all data back
        res.json({
            todaySales: todaySales._sum.totalAmount || 0,
            totalCash,
            totalProducts,
            lowStockItems: lowStockItems.slice(0, 5) // Only send top 5 lowest items
        });

    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;