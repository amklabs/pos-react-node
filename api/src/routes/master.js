const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// Add a Town
router.post('/towns', async (req, res) => {
    try {
        const {name} = req.body;
        const town = await prisma.town.create({data: {name}});
        res.json(town);
    } catch (error) {
        res.status(500).json({error: "Town already exists or invalid data"});
    }
});

router.get('/towns', async (req, res) => {
    const towns = await prisma.town.findMany();
    res.json(towns);
});

// Add a Customer
router.post('/customers', async (req, res) => {
    const {name, phone, townId} = req.body;
    const customer = await prisma.customer.create({
        data: {name, phone, townId: parseInt(townId)}
    });
    res.json(customer);
});

// Add a Salesmen
router.post('/salesmen', async (req, res) => {
    const {name, phone} = req.body;
    const salesman = await prisma.salesman.create({
        data: {name, phone}
    });
    res.json(salesman);
});

// Add a Products
router.post('/products', async (req, res) => {
    const {name, companyId} = req.body;
    const product = await prisma.product.create({
        data: {
            name,
            companyId: companyId ? parseInt(companyId) : null
        }
    });
    res.json(product);
});

// Get All Companies / Vendors
router.get('/companies', async (req, res) => { /* ... */
});

// router.get('/towns', async (req, res) => {
//     const towns = await prisma.town.findMany();
//     res.json(towns);
// });


//Dropdown Routes
router.get('/customers', async (req, res) => {
    const customers = await prisma.customer.findMany();
    res.json(customers);
});

router.get('/products', async (req, res) => {
    const products = await prisma.product.findMany();
    res.json(products);
});

router.get('/companies', async (req, res) => {
    const companies = await prisma.company.findMany();
    res.json(companies);
});

router.get('/salesmen', async (req, res) => {
    const salesmen = await prisma.salesman.findMany();
    res.json(salesmen);
});

module.exports = router;