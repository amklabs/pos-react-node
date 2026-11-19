const express = require('express');
const prisma = require('../db');
const { authenticateToken, requireRoles } = require('../midleware/auth');
const { ADMIN_ROLES } = require('../roles');

const router = express.Router();
router.use(authenticateToken);

// Reads allowed for all authenticated users; writes require admin roles
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    return requireRoles(...ADMIN_ROLES)(req, res, next);
});

function activeFlag(value, fallback = true) {
    if (value === undefined || value === null) return fallback;
    return Boolean(value);
}

// ---- Towns ----
router.post('/towns', async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Town name is required' });
        const town = await prisma.town.create({
            data: { name: name.trim(), isActive: activeFlag(req.body.isActive, true) },
        });
        res.status(201).json(town);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Town already exists' });
        }
        next(error);
    }
});

router.put('/towns/:id', async (req, res, next) => {
    try {
        const town = await prisma.town.update({
            where: { id: Number(req.params.id) },
            data: {
                name: req.body.name?.trim(),
                isActive: activeFlag(req.body.isActive, true),
            },
        });
        res.json(town);
    } catch (e) {
        next(e);
    }
});

router.delete('/towns/:id', async (req, res, next) => {
    try {
        await prisma.town.delete({ where: { id: Number(req.params.id) } });
        res.status(204).end();
    } catch (e) {
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this town is referenced by customers.',
            });
        }
        next(e);
    }
});

// ---- Customers ----
router.post('/customers', async (req, res, next) => {
    try {
        const { name, phone, townId } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Customer name is required' });
        if (!townId) return res.status(400).json({ error: 'Town is required' });
        const customer = await prisma.customer.create({
            data: {
                name: name.trim(),
                phone: phone || '',
                townId: parseInt(townId, 10),
                isActive: activeFlag(req.body.isActive, true),
            },
            include: { town: true },
        });
        res.status(201).json(customer);
    } catch (e) {
        next(e);
    }
});

router.put('/customers/:id', async (req, res, next) => {
    try {
        const { name, phone, townId } = req.body;
        const customer = await prisma.customer.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name?.trim(),
                phone: phone || '',
                townId: parseInt(townId, 10),
                isActive: activeFlag(req.body.isActive, true),
            },
            include: { town: true },
        });
        res.json(customer);
    } catch (e) {
        next(e);
    }
});

router.delete('/customers/:id', async (req, res, next) => {
    try {
        await prisma.customer.delete({ where: { id: Number(req.params.id) } });
        res.status(204).end();
    } catch (e) {
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this customer is referenced by other records.',
            });
        }
        next(e);
    }
});

// ---- Salesmen ----
router.post('/salesmen', async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Salesman name is required' });
        const salesman = await prisma.salesman.create({
            data: {
                name: name.trim(),
                phone: phone || '',
                isActive: activeFlag(req.body.isActive, true),
            },
        });
        res.status(201).json(salesman);
    } catch (e) {
        next(e);
    }
});

router.put('/salesmen/:id', async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        const salesman = await prisma.salesman.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name?.trim(),
                phone: phone || '',
                isActive: activeFlag(req.body.isActive, true),
            },
        });
        res.json(salesman);
    } catch (e) {
        next(e);
    }
});

router.delete('/salesmen/:id', async (req, res, next) => {
    try {
        await prisma.salesman.delete({ where: { id: Number(req.params.id) } });
        res.status(204).end();
    } catch (e) {
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this salesman is referenced by other records.',
            });
        }
        next(e);
    }
});

// ---- Products ----
router.post('/products', async (req, res, next) => {
    try {
        const { name, companyId } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
        if (!companyId) return res.status(400).json({ error: 'Company is required' });
        const product = await prisma.product.create({
            data: {
                name: name.trim(),
                companyId: parseInt(companyId, 10),
                isActive: activeFlag(req.body.isActive, true),
            },
            include: { company: true },
        });
        res.status(201).json(product);
    } catch (e) {
        next(e);
    }
});

router.put('/products/:id', async (req, res, next) => {
    try {
        const { name, companyId } = req.body;
        if (!companyId) return res.status(400).json({ error: 'Company is required' });
        const product = await prisma.product.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name?.trim(),
                companyId: parseInt(companyId, 10),
                isActive: activeFlag(req.body.isActive, true),
            },
            include: { company: true },
        });
        res.json(product);
    } catch (e) {
        next(e);
    }
});

router.delete('/products/:id', async (req, res, next) => {
    try {
        await prisma.product.delete({ where: { id: Number(req.params.id) } });
        res.status(204).end();
    } catch (e) {
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this product is referenced by invoices.',
            });
        }
        next(e);
    }
});

// ---- Companies ----
router.post('/companies', async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });
        const company = await prisma.company.create({
            data: {
                name: name.trim(),
                phone: phone || '',
                isActive: activeFlag(req.body.isActive, true),
            },
        });
        res.status(201).json(company);
    } catch (e) {
        next(e);
    }
});

router.put('/companies/:id', async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        const company = await prisma.company.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name?.trim(),
                phone: phone || '',
                isActive: activeFlag(req.body.isActive, true),
            },
        });
        res.json(company);
    } catch (e) {
        next(e);
    }
});

router.delete('/companies/:id', async (req, res, next) => {
    try {
        await prisma.company.delete({ where: { id: Number(req.params.id) } });
        res.status(204).end();
    } catch (e) {
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this company is referenced by products.',
            });
        }
        next(e);
    }
});

// ---- List / dropdown routes ----
router.get('/customers', async (req, res, next) => {
    try {
        const showAll = req.query.showAll === 'true';
        const customers = await prisma.customer.findMany({
            where: showAll ? {} : { isActive: true },
            include: { town: true },
            orderBy: { name: 'asc' },
        });
        res.json(customers);
    } catch (e) {
        next(e);
    }
});

router.get('/products', async (req, res, next) => {
    try {
        const showAll = req.query.showAll === 'true';
        const products = await prisma.product.findMany({
            where: showAll ? {} : { isActive: true },
            orderBy: { name: 'asc' },
            include: { company: true },
        });
        res.json(products);
    } catch (e) {
        next(e);
    }
});

router.get('/companies', async (req, res, next) => {
    try {
        const showAll = req.query.showAll === 'true';
        const companies = await prisma.company.findMany({
            where: showAll ? {} : { isActive: true },
            orderBy: { name: 'asc' },
        });
        res.json(companies);
    } catch (e) {
        next(e);
    }
});

router.get('/salesmen', async (req, res, next) => {
    try {
        const showAll = req.query.showAll === 'true';
        const salesmen = await prisma.salesman.findMany({
            where: showAll ? {} : { isActive: true },
            orderBy: { name: 'asc' },
        });
        res.json(salesmen);
    } catch (e) {
        next(e);
    }
});

router.get('/towns', async (req, res, next) => {
    try {
        const showAll = req.query.showAll === 'true';
        const towns = await prisma.town.findMany({
            where: showAll ? {} : { isActive: true },
            orderBy: { name: 'asc' },
        });
        res.json(towns);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
