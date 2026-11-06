const express = require('express');
const prisma = require('../db');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();
router.use(authenticateToken); // everything below is protected

router.post('/towns', async (req, res) => { /* ... */
});
router.get('/towns', async (req, res) => { /* ... */
});
router.post('/customers', async (req, res) => { /* ... */
});
router.get('/customers', async (req, res) => { /* ... */
});
router.post('/salesmen', async (req, res) => { /* ... */
});
router.get('/salesmen', async (req, res) => { /* ... */
});
router.post('/products', async (req, res) => { /* ... */
});
router.get('/products', async (req, res) => { /* ... */
});
router.get('/companies', async (req, res) => { /* ... */
});

module.exports = router;