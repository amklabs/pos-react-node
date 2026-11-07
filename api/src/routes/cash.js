const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected


// Add a Cash Record
router.post('/cash', async (req, res) => {
    try {
        const {date, customerId, amount, note} = req.body;
        const record = await prisma.cashRecord.create({
            data: {
                date: new Date(date),
                type: 'RECEIVED',
                customerId: customerId ? parseInt(customerId) : null,
                amount: parseFloat(amount),
                note
            }
        });
        res.json(record);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Get all Cash Records
router.get('/cash', async (req, res) => {
    const records = await prisma.cashRecord.findMany({
        include: {customer: true},
        orderBy: {date: 'desc'}
    });
    res.json(records);
});

module.exports = router;