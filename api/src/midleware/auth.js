const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const prisma = require('../db');

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Un-authenticated access. Please log in to proceed.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { role: true },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid or inactive user' });
        }

        req.user = {
            userId: user.id,
            username: user.username,
            role: user.role?.name || null,
        };
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticateToken, requireRoles };
