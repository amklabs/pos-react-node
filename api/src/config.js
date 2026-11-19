require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        'JWT_SECRET is required. Set it in api/.env (see api/.env.example).'
    );
}

module.exports = {
    JWT_SECRET,
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
};
