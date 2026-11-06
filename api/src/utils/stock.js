// src/utils/stock.js
async function getProductStock(prisma, productId) {
    const [purchased, sold, returned] = await Promise.all([
        prisma.invoiceItem.aggregate({
            _sum: { qty: true },
            where: { productId, invoice: { type: 'PURCHASE' } },
        }),
        prisma.invoiceItem.aggregate({
            _sum: { qty: true },
            where: { productId, invoice: { type: 'SALE' } },
        }),
        prisma.invoiceItem.aggregate({
            _sum: { qty: true },
            where: { productId, invoice: { type: 'RETURN' } },
        }),
    ]);
    const p = purchased._sum.qty || 0;
    const s = sold._sum.qty || 0;
    const r = returned._sum.qty || 0;
    return { purchased: p, sold: s, returned: r, balance: p - s + r };
}

module.exports = { getProductStock };