// api/index.js nodemon api/index.js
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: path.join(__dirname, '.env')});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-akhlaq-pos-key';

const {PrismaClient} = require('./generated/prisma');
const {PrismaPg} = require('@prisma/adapter-pg')

const connectionString = process.env.DATABASE_URL
const adapter = new PrismaPg({connectionString})
const prisma = new PrismaClient({adapter}) // Pass adapter to constructor


const app = express();
// const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
})


// 1. Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

        // Create Token
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ token, username: user.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Middleware to Protect Routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next(); // Allow the request to proceed
    });
};

// --- MASTER DATA ROUTES (Page 2) ---

// Add a Town
app.post('/api/towns', async (req, res) => {
    try {
        const {name} = req.body;
        const town = await prisma.town.create({data: {name}});
        res.json(town);
    } catch (error) {
        res.status(500).json({error: "Town already exists or invalid data"});
    }
});

// Add a Customer
app.post('/api/customers', async (req, res) => {
    const {name, phone, townId} = req.body;
    const customer = await prisma.customer.create({
        data: {name, phone, townId: parseInt(townId)}
    });
    res.json(customer);
});

// Add a Salesmen
app.post('/api/salesmen', async (req, res) => {
    const {name, phone} = req.body;
    const salesman = await prisma.salesman.create({
        data: {name, phone}
    });
    res.json(salesman);
});

// Add a Products
app.post('/api/products', async (req, res) => {
    const {name, companyId} = req.body;
    const product = await prisma.product.create({
        data: {
            name,
            companyId: companyId ? parseInt(companyId) : null
        }
    });
    res.json(product);
});

// Add a Cash Record
app.post('/api/cash', async (req, res) => {
    try {
        const {date, customerId, amount, note} = req.body;
        const record = await prisma.cashRecord.create({
            data: {
                date: new Date(date),
                type: 'RECEIVED',
                customerId: customerId ? parseInt(customerId) : null,
                amount: parseFloat(amount),
                note
            }
        });
        res.json(record);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Get all Cash Records
app.get('/api/cash', async (req, res) => {
    const records = await prisma.cashRecord.findMany({
        include: {customer: true},
        orderBy: {date: 'desc'}
    });
    res.json(records);
});

// Get all Invoices for Lookup
app.get('/api/invoices', async (req, res) => {
    const {type} = req.query;

    const invoices = await prisma.invoice.findMany({
        // If 'type' is provided, filter by it.
        // If 'type' is missing, filter OUT 'PURCHASE' (so it returns SALES and RETURNS)
        where: type ? {type: type} : {type: {not: 'PURCHASE'}},
        include: {
            customer: true,
            salesman: true,
            town: true,
            items: {include: {product: true}}
        },
        orderBy: {date: 'desc'}
    });
    res.json(invoices);
});

// Get a Single Invoice by ID (for detailed view/printing)
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: {id: parseInt(req.params.id)},
            include: {
                customer: true,
                salesman: true,
                town: true,
                items: {include: {product: true}}
            }
        });
        if (!invoice) return res.status(404).json({error: "Invoice not found"});
        res.json(invoice);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Create a New Sale/Purchase Invoice
app.post('/api/invoices', async (req, res) => {
    const {invoiceNo, type, townId, customerId, salesmanId, items} = req.body;

    // Calculate total
    let total = 0;
    const formattedItems = items.map(item => {
        const itemTotal = (item.qty * item.rate) - (item.discount || 0);
        total += itemTotal;
        return {
            productId: parseInt(item.productId),
            qty: parseInt(item.qty),
            rate: parseFloat(item.rate),
            discount: item.discount || 0
        };
    });

    try {
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNo,
                type, // "SALE" or "PURCHASE"
                townId: parseInt(townId),
                customerId: customerId ? parseInt(customerId) : null,
                salesmanId: salesmanId ? parseInt(salesmanId) : null,
                totalAmount: total,
                items: {
                    create: formattedItems
                }
            }
        });
        res.json(invoice);
    } catch (error) {
        res.status(500).json({error: "Failed to create invoice", details: error.message});
    }
});

// Get Sales Report (Page 3)
app.get('/api/reports/sales', async (req, res) => {
    const {from, to} = req.query;
    const invoices = await prisma.invoice.findMany({
        where: {
            type: 'SALE',
            date: {
                gte: new Date(from),
                lte: new Date(to)
            }
        },
        include: {
            customer: true,
            salesman: true,
            items: {include: {product: true}}
        }
    });
    res.json(invoices);
});

// 1. Sales Report (Filtered by Date)
app.get('/api/reports/sales', async (req, res) => {
    const {from, to} = req.query;

    try {
        const whereClause = {type: 'SALE'};
        if (from && to) {
            whereClause.date = {
                gte: new Date(from),
                lte: new Date(to)
            };
        }

        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: {
                customer: true,
                salesman: true,
                items: {include: {product: true}}
            },
            orderBy: {date: 'desc'}
        });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// 2. Stock Report
app.get('/api/reports/stock', async (req, res) => {
    try {
        // Get all products
        const products = await prisma.product.findMany();

        // For each product, calculate purchased, sold, returned, and balance
        const stockData = await Promise.all(products.map(async (product) => {
            // Total Purchased
            const purchased = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'PURCHASE'}}
            });

            // Total Sold
            const sold = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'SALE'}}
            });

            // Total Returned
            const returned = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'RETURN'}}
            });

            const pQty = purchased._sum.qty || 0;
            const sQty = sold._sum.qty || 0;
            const rQty = returned._sum.qty || 0;
            const balance = pQty - sQty + rQty;

            return {
                id: product.id,
                name: product.name,
                purchasedQty: pQty,
                soldQty: sQty,
                returnQty: rQty,
                balanceQty: balance
            };
        }));

        res.json(stockData);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// 3. All Cash Record (Overall Summary)
app.get('/api/reports/cash-summary', async (req, res) => {
    try {
        const records = await prisma.cashRecord.findMany({
            include: {customer: true},
            orderBy: {date: 'desc'}
        });

        const totalCash = records.reduce((sum, record) => {
            return record.type === 'RECEIVED' ? sum + record.amount : sum - record.amount;
        }, 0);

        res.json({records, totalCash});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// Process a Stock Return
app.post('/api/returns', async (req, res) => {
    const {invoiceNo, date, townId, customerId, items} = req.body;

    try {
        // 1. Create the Return Invoice
        let totalRefund = 0;
        const formattedItems = items.map(item => {
            const itemTotal = (item.qty * item.rate) - (item.discount || 0);
            totalRefund += itemTotal;
            return {
                productId: parseInt(item.productId),
                qty: parseInt(item.qty),
                rate: parseFloat(item.rate),
                discount: parseFloat(item.discount) || 0
            };
        });

        const returnInvoice = await prisma.invoice.create({
            data: {
                invoiceNo,
                type: 'RETURN', // This is the magic word that adds stock back
                townId: parseInt(townId),
                customerId: customerId ? parseInt(customerId) : null,
                totalAmount: totalRefund, // Refund amount
                date: new Date(date),
                items: {
                    create: formattedItems
                }
            }
        });

        // 2. Automatically record the Cash OUT (Refund)
        if (customerId) {
            await prisma.cashRecord.create({
                data: {
                    date: new Date(date),
                    type: 'REFUND', // Money goes out
                    customerId: parseInt(customerId),
                    amount: totalRefund,
                    note: `Refund for Return Invoice #${invoiceNo}`
                }
            });
        }

        res.json({message: "Return processed successfully", returnInvoice});
    } catch (error) {
        res.status(500).json({error: "Failed to process return", details: error.message});
    }
});


// --- DASHBOARD SUMMARY ---
app.get('/api/dashboard', async (req, res) => {
    try {
        // 1. Get today's date range (start of day to end of day)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 2. Today's Sales Total
        const todaySales = await prisma.invoice.aggregate({
            _sum: {totalAmount: true},
            where: {
                type: 'SALE',
                date: {gte: startOfDay, lte: endOfDay}
            }
        });

        // 3. Total Cash In Hand (Received - Refunds)
        const cashRecords = await prisma.cashRecord.findMany();
        const totalCash = cashRecords.reduce((sum, rec) => {
            return rec.type === 'RECEIVED' ? sum + rec.amount : sum - rec.amount;
        }, 0);

        // 4. Total Products Count
        const totalProducts = await prisma.product.count();

        // 5. Low Stock Alerts (Using the logic from our Stock Report)
        const products = await prisma.product.findMany();
        const lowStockItems = [];

        for (const product of products) {
            const purchased = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'PURCHASE'}}
            });
            const sold = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'SALE'}}
            });
            const returned = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'RETURN'}}
            });

            const balance = (purchased._sum.qty || 0) - (sold._sum.qty || 0) + (returned._sum.qty || 0);

            // If stock is less than 10, add to low stock list
            if (balance < 10) {
                lowStockItems.push({name: product.name, balance});
            }
        }

        // Send all data back
        res.json({
            todaySales: todaySales._sum.totalAmount || 0,
            totalCash,
            totalProducts,
            lowStockItems: lowStockItems.slice(0, 5) // Only send top 5 lowest items
        });

    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

// --- CUSTOMER LEDGER ---
app.get('/api/customers/:id/ledger', async (req, res) => {
    const customerId = parseInt(req.params.id);

    try {
        // Get all Sales for this customer
        const sales = await prisma.invoice.findMany({
            where: {customerId, type: 'SALE'},
            orderBy: {date: 'asc'}
        });

        // Get all Cash Received from this customer
        const cash = await prisma.cashRecord.findMany({
            where: {customerId, type: 'RECEIVED'},
            orderBy: {date: 'asc'}
        });

        // Get Customer info
        const customer = await prisma.customer.findUnique({
            where: {id: customerId},
            include: {town: true}
        });

        // Combine and sort all transactions by date
        const transactions = [
            ...sales.map(s => ({date: s.date, type: 'SALE (Debit)', ref: s.invoiceNo, amount: s.totalAmount})),
            ...cash.map(c => ({date: c.date, type: 'CASH (Credit)', ref: c.note || '-', amount: c.amount}))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance and totals
        let balance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const ledger = transactions.map(t => {
            if (t.type.includes('SALE')) {
                totalDebit += t.amount;
                balance += t.amount;
            } else {
                totalCredit += t.amount;
                balance -= t.amount;
            }
            return {...t, runningBalance: balance};
        });

        res.json({customer, ledger, totalDebit, totalCredit, finalBalance: balance});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.get('/api/reports/stock', async (req, res) => {
    try {
        const products = await prisma.product.findMany();

        const stockData = await Promise.all(products.map(async (product) => {
            // Get all purchase items to calculate Average Cost
            const purchaseItems = await prisma.invoiceItem.findMany({
                where: {productId: product.id, invoice: {type: 'PURCHASE'}}
            });

            const totalPurchaseQty = purchaseItems.reduce((sum, item) => sum + item.qty, 0);
            const totalPurchaseAmount = purchaseItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
            const avgPurchaseRate = totalPurchaseQty > 0 ? (totalPurchaseAmount / totalPurchaseQty) : 0;

            // Calculate current balances
            const sold = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'SALE'}}
            });
            const returned = await prisma.invoiceItem.aggregate({
                _sum: {qty: true},
                where: {productId: product.id, invoice: {type: 'RETURN'}}
            });

            const balanceQty = totalPurchaseQty - (sold._sum.qty || 0) + (returned._sum.qty || 0);
            const stockValue = balanceQty * avgPurchaseRate;

            return {
                id: product.id,
                name: product.name,
                purchasedQty: totalPurchaseQty,
                soldQty: sold._sum.qty || 0,
                returnQty: returned._sum.qty || 0,
                balanceQty,
                avgRate: avgPurchaseRate.toFixed(2),
                stockValue: stockValue
            };
        }));

        res.json(stockData);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.get('/api/towns', async (req, res) => {
    const towns = await prisma.town.findMany();
    res.json(towns);
});


//Dropdown Routes
app.get('/api/customers', async (req, res) => {
    const customers = await prisma.customer.findMany();
    res.json(customers);
});

app.get('/api/products', async (req, res) => {
    const products = await prisma.product.findMany();
    res.json(products);
});

app.get('/api/companies', async (req, res) => {
    const companies = await prisma.company.findMany();
    res.json(companies);
});

app.get('/api/salesmen', async (req, res) => {
    const salesmen = await prisma.salesman.findMany();
    res.json(salesmen);
});


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
if (require.main === module) {
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    const startServer = requestedPort => {
        const server = app.listen(requestedPort);
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
    };

    startServer(port);
}

module.exports = app;


//
// const express = require('express');
// const cors = require('cors');
// const { PORT } = require('../src/config');
//
// const app = express();
// app.use(cors());
// app.use(express.json());
//
// app.get('/', (req, res) => res.send('Hello World!'));
//
// app.use('/api', require('../src/routes/auth'));       // public
// app.use('/api', require('../src/routes/master'));     // protected
// app.use('/api', require('../src/routes/invoices'));   // protected
// app.use('/api', require('../src/routes/cash'));       // protected
// app.use('/api', require('../src/routes/reports'));    // protected
// app.use('/api', require('../src/routes/ledger'));     // protected
//
// if (require.main === module) {
//     app.listen(PORT, () => console.log(`API listening on ${PORT}`));
// }
//
// module.exports = app;