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
const {PORT} = require('./src/config');

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


