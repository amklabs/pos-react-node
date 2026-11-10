const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

// Add a Town
router.post('/towns', async (req, res) => {
    try {
        const {name, isActive} = req.body;
        const town = await prisma.town.create({data: {name}});
        res.json(town);
    } catch (error) {
        res.status(500).json({error: "Town already exists or invalid data"});
    }
});

// Update a Town
router.put('/towns/:id', async (req, res) => {
    try {
        const town = await prisma.town.update({
            where: {id: Number(req.params.id)},
            data: {name: req.body.name, isActive: req.body.isActive },
        });
        res.json(town);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// Delete A Town
router.delete('/towns/:id', async (req, res) => {
    try {
        await prisma.town.delete({where: {id: Number(req.params.id)}});
        res.status(204).end();
    } catch (e) {
        // Prisma P2003 = foreign key constraint violation
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this town is referenced by customers.',
            });
        }
        res.status(400).json({error: e.message});
    }
});

// Add a Customer
router.post('/customers', async (req, res) => {
    const {name, phone, townId} = req.body;
    const customer = await prisma.customer.create({
        data: {name, phone, townId: parseInt(townId)}
    });
    res.json(customer);
});

// Update a Customer
router.put('/customers/:id', async (req, res) => {
    try {
        const {name, phone, townId} = req.body;
        const customer = await prisma.customer.update({
            where: {id: Number(req.params.id)},
            data: {
                name,
                phone,
                townId: parseInt(townId),
            },
        });
        res.json(customer);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// Delete a Customer
router.delete('/customers/:id', async (req, res) => {
    try {
        await prisma.customer.delete({where: {id: Number(req.params.id)}});
        res.status(204).end();
    } catch (e) {
        // Prisma P2003 = foreign key constraint violation
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this Customer is referenced by other tables.',
            });
        }
        res.status(400).json({error: e.message});
    }
});

// Add a Salesmen
router.post('/salesmen', async (req, res) => {
    const {name, phone} = req.body;
    const salesman = await prisma.salesman.create({
        data: {name, phone}
    });
    res.json(salesman);
});

// Update a Salesman
router.put('/salesmen/:id', async (req, res) => {
    try {
        const {name, phone} = req.body;
        const salesman = await prisma.salesman.update({
            where: {id: Number(req.params.id)},
            data: {
                name,
                phone,
            },
        });
        res.json(salesman);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// Delete a Salesman
router.delete('/salesmen/:id', async (req, res) => {
    try {
        await prisma.salesman.delete({where: {id: Number(req.params.id)}});
        res.status(204).end();
    } catch (e) {
        // Prisma P2003 = foreign key constraint violation
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this Salesman is referenced by other tables.',
            });
        }
        res.status(400).json({error: e.message});
    }
});


// Add a Products
router.post('/products', async (req, res) => {
    const {name, companyId} = req.body;
    const product = await prisma.product.create({
        data: {
            name,
            companyId: companyId ? parseInt(companyId) : null,
            isActive : req.body.isActive,
        }
    });
    res.json(product);
});

// Update a Products
router.put('/products/:id', async (req, res) => {
    try {
        const {name, companyId} = req.body;
        const product = await prisma.product.update({
            where: {id: Number(req.params.id)},
            data: {
                name,
                companyId: companyId ? parseInt(companyId) : null,
                isActive : req.body.isActive,
            },
        });
        res.json(product);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// Delete a Product
router.delete('/products/:id', async (req, res) => {
    try {
        await prisma.product.delete({where: {id: Number(req.params.id)}});
        res.status(204).end();
    } catch (e) {
        // Prisma P2003 = foreign key constraint violation
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this Product is referenced by other tables.',
            });
        }
        res.status(400).json({error: e.message});
    }
});

// Add a New Company
router.post('/companies', async (req, res) => {
    const {name, phone} = req.body;
    const company = await prisma.company.create({
        data: {
            name,
            phone
        }
    });
    res.json(company);
});

// Update a Products
router.put('/companies/:id', async (req, res) => {
    try {
        const {name, phone} = req.body;
        const company = await prisma.company.update({
            where: {id: Number(req.params.id)},
            data: {
                name,
                phone
            },
        });
        res.json(company);
    } catch (e) {
        res.status(400).json({error: e.message});
    }
});

// Delete a Product
router.delete('/companies/:id', async (req, res) => {
    try {
        await prisma.company.delete({where: {id: Number(req.params.id)}});
        res.status(204).end();
    } catch (e) {
        // Prisma P2003 = foreign key constraint violation
        if (e.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete: this Company is referenced by other tables.',
            });
        }
        res.status(400).json({error: e.message});
    }
});


//Dropdown Routes
router.get('/customers', async (req, res) => {
    const customers = await prisma.customer.findMany({
        where: {isActive: true},
        include: {town: true}
    });
    res.json(customers);
});

router.get('/products', async (req, res) => {
    const showAll = req.query.showAll === 'true';
    const products = await prisma.product.findMany({
        where: showAll ? {} : { isActive: true },
        orderBy: { name: 'asc' }, // optional
        include: {company: true}
    });
    res.json(products);
});

router.get('/companies', async (req, res) => {
    const companies = await prisma.company.findMany({
        where: {isActive: true},
    });
    res.json(companies);
});

router.get('/salesmen', async (req, res) => {
    const salesmen = await prisma.salesman.findMany({
        where: {isActive: true},
    });
    res.json(salesmen);
});

//-----Towns --------
router.get('/towns', async (req, res) => {
    const showAll = req.query.showAll === 'true';

    const towns = await prisma.town.findMany({
        where: showAll ? {} : { isActive: true },
        orderBy: { name: 'asc' }, // optional
    });

    res.json(towns);
});

module.exports = router;