const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const {JWT_SECRET} = require('../config');
const {authenticateToken} = require('../midleware/auth');

const router = express.Router();

// POST /logout
// JWTs are stateless, so "logout" is client-side (discard the token).
// This endpoint exists so clients have a consistent API to call.
router.post('/logout', authenticateToken, (req, res) => {
    // If you later add a token blacklist / refresh-token revocation,
    // do it here. For now, just confirm success.
    res.json({message: 'Logged out successfully'});
});

// GET /user
// Returns the currently authenticated user's basic info.
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {id: req.user.userId},
            select: {id: true, username: true},
        });
        if (!user) {
            return res.status(404).json({error: 'User not found'});
        }
        res.json({user});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;