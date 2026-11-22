// One-time backfill: set InvoiceItem.costRate from Product.lastPRate for SALE/RETURN
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../src/db');

async function main() {
    const result = await prisma.$executeRaw`
        UPDATE "InvoiceItem" AS ii
        SET "costRate" = p."lastPRate"
        FROM "Product" AS p, "Invoice" AS i
        WHERE ii."productId" = p.id
          AND ii."invoiceId" = i.id
          AND i.type IN ('SALE', 'RETURN')
          AND ii."costRate" = 0
          AND p."lastPRate" <> 0
    `;
    console.log('Backfilled rows:', result);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
