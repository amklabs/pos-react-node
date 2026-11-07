// api/index.js nodemon api/index.js
// app.get('/api/seed', async (req, res) => {
//     try {
//         const town = await prisma.town.create({ data: { name: "Karachi" } });
//         const company = await prisma.company.create({ data: { name: "Test Company", phone: "1234567890" } });
//         const product = await prisma.product.create({ data: { name: "Test Product", companyId: company.id } });
//         const customer = await prisma.customer.create({ data: { name: "John Doe", phone: "0987654321", townId: town.id } });
//
//         res.json({ message: "Data seeded!", town, product, customer });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });
const express = require('express');
const cors = require('cors');
const { PORT } = require('./src/config');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Hello World!'));

app.use('/api', require('./src/routes/auth'));       // public
app.use('/api', require('./src/routes/home'));       // home/dashboard protected
app.use('/api', require('./src/routes/master'));     // protected
app.use('/api', require('./src/routes/invoices'));   // protected
app.use('/api', require('./src/routes/cash'));       // protected
app.use('/api', require('./src/routes/reports'));    // protected
app.use('/api', require('./src/routes/ledger'));     // protected
app.use('/api', require('./src/routes/returns'));   // protected
app.use('/api', require('./src/routes/user'));      // protected

if (require.main === module) {
    app.listen(PORT, () => console.log(`API listening on ${PORT}`));
}

module.exports = app;


// app.get('/api/seed-user', async (req, res) => {
//     const hashedPassword = await bcrypt.hash('Ansar123', 10);
//
//     const admin = await prisma.user.upsert({
//         where: {username: 'Ansar'},
//         update: {},
//         create: {
//             username: 'Ansar',
//             password: hashedPassword,
//             createdAt: new Date().toISOString(),
//         },
//     });
//
//     console.log('Admin user created!');
//     res.status(200).json({ message: 'Admin user created!' });
// });

// Export for Vercel
// if (require.main === module) {
//     const port = process.env.PORT ? Number(process.env.PORT) : 3000;
//     const startServer = requestedPort => {
//         const server = app.listen(requestedPort);
// server.once('listening', () => {
//     console.log(`API server listening on port ${server.address().port}`);
// });
// server.once('error', error => {
//     if (requestedPort !== 0 && ['EACCES', 'EADDRINUSE'].includes(error.code)) {
//         console.warn(`Port ${requestedPort} is unavailable; using an available port.`);
//         startServer(0);
//         return;
//     }
//     console.error(`Failed to start API server: ${error.message}`);
//     process.exitCode = 1;
// });
//     };
//
//     startServer(port);
// }
//
// module.exports = app;


