// seed.js
const bcrypt = require('bcryptjs');



const {PrismaClient} = require('../generated/prisma');
const {PrismaPg} = require('@prisma/adapter-pg')
const path = require("node:path");
require('dotenv').config({path: path.join(__dirname, '.env')});
const connectionString = process.env.DATABASE_URL
const adapter = new PrismaPg({connectionString})
const prisma = new PrismaClient({adapter}) // Pass adapter to constructor

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: {username: 'admin'},
        update: {},
        create: {
            username: 'admin',
            password: hashedPassword,
        },
    });

    console.log('Admin user created!');
    console.log('Username: admin');
    console.log('Password: admin123');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());