const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { authenticateToken, requireRoles } = require('../midleware/auth');
const { ROLES } = require('../roles');
const { httpError, parseId } = require('../utils/validate');

const router = express.Router();
const SALT_ROUNDS = 10;

function toSafeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
}

async function countActiveSuperAdmins() {
    return prisma.user.count({
        where: {
            isActive: true,
            role: { name: ROLES.SUPER_ADMIN },
        },
    });
}

async function resolveRoleId(roleId) {
    const id = parseId(roleId, 'roleId');
    const role = await prisma.role.findFirst({
        where: { id, isActive: true },
    });
    if (!role) throw httpError(400, 'Invalid or inactive role');
    return role;
}

// POST /logout
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// GET /user — current authenticated user
router.get('/user', authenticateToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            include: { role: true },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        res.json({ user: toSafeUser(user) });
    } catch (error) {
        next(error);
    }
});

// ---- Super Admin only: roles + user management ----
router.use(authenticateToken, requireRoles(ROLES.SUPER_ADMIN));

// GET /roles
router.get('/roles', async (_req, res, next) => {
    try {
        const roles = await prisma.role.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, isActive: true },
        });
        res.json(roles);
    } catch (error) {
        next(error);
    }
});

// GET /users
router.get('/users', async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            include: { role: true },
            orderBy: [{ isActive: 'desc' }, { username: 'asc' }],
        });
        res.json(users.map(toSafeUser));
    } catch (error) {
        next(error);
    }
});

// POST /users
router.post('/users', async (req, res, next) => {
    try {
        const { username, password, firstname, lastname, roleId, isActive } = req.body;

        if (!username?.trim()) throw httpError(400, 'Username is required');
        if (!password || String(password).length < 4) {
            throw httpError(400, 'Password must be at least 4 characters');
        }
        if (!roleId) throw httpError(400, 'Role is required');

        const role = await resolveRoleId(roleId);
        const hashed = await bcrypt.hash(String(password), SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                username: username.trim(),
                password: hashed,
                firstname: firstname?.trim() || null,
                lastname: lastname?.trim() || null,
                roleId: role.id,
                isActive: isActive === undefined ? true : Boolean(isActive),
            },
            include: { role: true },
        });

        res.status(201).json(toSafeUser(user));
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        next(error);
    }
});

// PUT /users/:id
router.put('/users/:id', async (req, res, next) => {
    try {
        const id = parseId(req.params.id, 'user id');
        const { username, password, firstname, lastname, roleId, isActive } = req.body;

        const existing = await prisma.user.findUnique({
            where: { id },
            include: { role: true },
        });
        if (!existing) throw httpError(404, 'User not found');

        const data = {};

        if (username !== undefined) {
            if (!username?.trim()) throw httpError(400, 'Username is required');
            data.username = username.trim();
        }
        if (firstname !== undefined) data.firstname = firstname?.trim() || null;
        if (lastname !== undefined) data.lastname = lastname?.trim() || null;

        if (roleId !== undefined) {
            const role = await resolveRoleId(roleId);
            data.roleId = role.id;
        }

        if (password !== undefined && password !== null && String(password).length > 0) {
            if (String(password).length < 4) {
                throw httpError(400, 'Password must be at least 4 characters');
            }
            data.password = await bcrypt.hash(String(password), SALT_ROUNDS);
        }

        if (isActive !== undefined) {
            const nextActive = Boolean(isActive);
            if (id === req.user.userId && !nextActive) {
                throw httpError(400, 'You cannot deactivate your own account');
            }
            if (
                existing.isActive &&
                !nextActive &&
                existing.role?.name === ROLES.SUPER_ADMIN
            ) {
                const supers = await countActiveSuperAdmins();
                if (supers <= 1) {
                    throw httpError(400, 'Cannot deactivate the last Super Admin');
                }
            }
            data.isActive = nextActive;
        }

        // Demoting / changing role away from Super Admin
        if (
            data.roleId !== undefined &&
            existing.role?.name === ROLES.SUPER_ADMIN &&
            existing.isActive
        ) {
            const newRole = await prisma.role.findUnique({ where: { id: data.roleId } });
            if (newRole?.name !== ROLES.SUPER_ADMIN) {
                const supers = await countActiveSuperAdmins();
                if (supers <= 1) {
                    throw httpError(400, 'Cannot change role of the last Super Admin');
                }
            }
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            include: { role: true },
        });

        res.json(toSafeUser(user));
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        next(error);
    }
});

// DELETE /users/:id
router.delete('/users/:id', async (req, res, next) => {
    try {
        const id = parseId(req.params.id, 'user id');

        if (id === req.user.userId) {
            throw httpError(400, 'You cannot delete your own account');
        }

        const existing = await prisma.user.findUnique({
            where: { id },
            include: { role: true },
        });
        if (!existing) throw httpError(404, 'User not found');

        if (existing.role?.name === ROLES.SUPER_ADMIN && existing.isActive) {
            const supers = await countActiveSuperAdmins();
            if (supers <= 1) {
                throw httpError(400, 'Cannot delete the last Super Admin');
            }
        }

        await prisma.user.delete({ where: { id } });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

module.exports = router;
