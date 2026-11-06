const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// Get Sales Report (Page 3)
router.get('/reports/sales', async (req, res) => {
    const {from, to} = req.query;
    const invoices = await prisma.invoice.findMany({
        where: {
            type: 'SALE',
            date: {
                gte: new Date(from),
                lte: new Date(to)
            }
        },
        include: {
            customer: true,
            salesman: true,
            items: {include: {product: true}}
        }
    });
    res.json(invoices);
});

// 1. Sales Report (Filtered by Date)
router.get('/reports/sales', async (req, res) => {
    const {from, to} = req.query;

    try {
        const whereClause = {type: 'SALE'};
        if (from && to) {
            whereClause.date = {
                gte: new Date(from),
                lte: new Date(to)
            };
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: {
                customer: true,
                salesman: true,
                items: {include: {product: true}}
            },
            orderBy: {date: 'desc'}
        });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// 2. Stock Report
router.get('/reports/stock', async (req, res) => {
    try {
        // Get all products
        const products = await prisma.product.findMany();

        // For each product, calculate purchased, sold, returned, and balance
        const stockData = await Promise.all(products.map(async (product) => {
            // Total Purchased
            const purchased = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'PURCHASE'}}
            });

            // Total Sold
            const sold = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'SALE'}}
            });

            // Total Returned
            const returned = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'RETURN'}}
            });

            const pQty = purchased._sum.qty || 0;
            const sQty = sold._sum.qty || 0;
            const rQty = returned._sum.qty || 0;
            const balance = pQty - sQty + rQty;

            return {
                id: product.id,
                name: product.name,
                purchasedQty: pQty,
                soldQty: sQty,
                returnQty: rQty,
                balanceQty: balance
            };
        }));

        res.json(stockData);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// 3. All Cash Record (Overall Summary)
router.get('/reports/cash-summary', async (req, res) => {
    try {
        const records = await prisma.cashRecord.findMany({
            include: {customer: true},
            orderBy: {date: 'desc'}
        });

        const totalCash = records.reduce((sum, record) => {
            return record.type === 'RECEIVED' ? sum + record.amount : sum - record.amount;
        }, 0);

        res.json({records, totalCash});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// router.get('/reports/stock', async (req, res) => {
//     try {
//         const products = await prisma.product.findMany();
//
//         const stockData = await Promise.all(products.map(async (product) => {
//             // Get all purchase items to calculate Average Cost
//             const purchaseItems = await prisma.invoiceItem.findMany({
//                 where: {productId: product.id, invoice: {type: 'PURCHASE'}}
//             });
//
//             const totalPurchaseQty = purchaseItems.reduce((sum, item) => sum + item.qty, 0);
//             const totalPurchaseAmount = purchaseItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
//             const avgPurchaseRate = totalPurchaseQty > 0 ? (totalPurchaseAmount / totalPurchaseQty) : 0;
//
//             // Calculate current balances
//             const sold = await prisma.invoiceItem.aggregate({
//                 _sum: {qty: true},
//                 where: {productId: product.id, invoice: {type: 'SALE'}}
//             });
//             const returned = await prisma.invoiceItem.aggregate({
//                 _sum: {qty: true},
//                 where: {productId: product.id, invoice: {type: 'RETURN'}}
//             });
//
//             const balanceQty = totalPurchaseQty - (sold._sum.qty || 0) + (returned._sum.qty || 0);
//             const stockValue = balanceQty * avgPurchaseRate;
//
//             return {
//                 id: product.id,
//                 name: product.name,
//                 purchasedQty: totalPurchaseQty,
//                 soldQty: sold._sum.qty || 0,
//                 returnQty: returned._sum.qty || 0,
//                 balanceQty,
//                 avgRate: avgPurchaseRate.toFixed(2),
//                 stockValue: stockValue
//             };
//         }));
//
//         res.json(stockData);
//     } catch (error) {
//         res.status(500).json({error: error.message});
//     }
// });

module.exports = router;
