const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { JWT_SECRET } = require('../config');

const router = express.Router();

function toSafeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
}

// POST /login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token, user: toSafeUser(user) });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /register — disabled; users must be created by an administrator
router.post('/register', (_req, res) => {
    res.status(403).json({
        error: 'Public registration is disabled. Contact an administrator.',
    });
});

module.exports = router;
