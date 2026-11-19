const express = require('express');
const prisma = require('../db');
const { authenticateToken } = require('../midleware/auth');

const router = express.Router();

// POST /logout
// JWTs are stateless, so "logout" is client-side (discard the token).
// This endpoint exists so clients have a consistent API to call.
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// GET /user
// Returns the currently authenticated user's basic info.
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { role: true },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        const { password, ...safeUser } = user;
        res.json({ user: safeUser });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load user' });
    }
});

module.exports = router;
