require('dotenv').config();
module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || 'super-secret-akhlaq-pos-key',
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
};