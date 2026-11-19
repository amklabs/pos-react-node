// api/index.js nodemon api/index.js
const express = require('express');
const cors = require('cors');
const { PORT } = require('./src/config');
const { errorHandler } = require('./src/midleware/errorHandler');

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
app.use('/api', require('./src/routes/returns'));    // protected
app.use('/api', require('./src/routes/user'));       // protected

app.use(errorHandler);

if (require.main === module) {
    app.listen(PORT, () => console.log(`API listening on ${PORT}`));
}

module.exports = app;
