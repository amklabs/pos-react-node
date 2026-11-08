// seed.js
const bcrypt = require('bcryptjs');
const path = require("node:path");
require('dotenv').config({path: path.join(__dirname, '..','.env')});

const {PrismaClient} = require('../generated/prisma');
const {PrismaPg} = require('@prisma/adapter-pg')

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
}

const connectionString = process.env.DATABASE_URL
const adapter = new PrismaPg({connectionString})
const prisma = new PrismaClient({adapter}) // Pass adapter to constructor


async function main() {
    const [superAdminRole, storeAdminRole, storeOperatorRole] = await prisma.$transaction([
        prisma.role.upsert({ where: { name: 'Super Admin' },    update: {}, create: { name: 'Super Admin' } }),
        prisma.role.upsert({ where: { name: 'Store Admin' },    update: {}, create: { name: 'Store Admin' } }),
        prisma.role.upsert({ where: { name: 'Store Operator' }, update: {}, create: { name: 'Store Operator' } }),
    ]);

    let hashedPassword = await bcrypt.hash('superadmin123', 10);

    const superAdmin = await prisma.user.upsert({
        where: {username: 'superadmin'},
        update: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            roleId: superAdminRole.id,
        },
        create: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            username: 'superadmin',
            roleId: superAdminRole.id,
            password: hashedPassword,
        },
    });

    console.log('Super Admin user created!');
    console.log('Username: superadmin');
    console.log('Password: superadmin123');

    hashedPassword = await bcrypt.hash('storeadmin123', 10);
    const storeAdmin = await prisma.user.upsert({
        where: {username: 'storeadmin'},
        update: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            roleId: storeAdminRole.id,
        },
        create: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            username: 'storeadmin',
            roleId: storeAdminRole.id,
            password: hashedPassword,
        },
    });

    console.log('Store Admin user created!');
    console.log('Username: storeadmin');
    console.log('Password: storeadmin123');

    hashedPassword = await bcrypt.hash('storeoperator123', 10);
    const storeOperator = await prisma.user.upsert({
        where: {username: 'storeoperator'},
        update: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            roleId: storeOperatorRole.id,
        },
        create: {
            firstname: 'Ansar',
            lastname: 'Mehmood Khan',
            username: 'storeoperator',
            roleId: storeOperatorRole.id,
            password: hashedPassword,
        },
    });

    console.log('Store Operator user created!');
    console.log('Username: storeoperator');
    console.log('Password: storeoperator123');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());