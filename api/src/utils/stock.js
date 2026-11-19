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
    const p = Number(purchased._sum.qty || 0);
    const s = Number(sold._sum.qty || 0);
    const r = Number(returned._sum.qty || 0);
    return { purchased: p, sold: s, returned: r, balance: p - s + r };
}

/**
 * Ensures each product in the sale has enough on-hand stock.
 * Aggregates duplicate product lines before checking.
 * @throws {{ message: string, status: number, productId: number, available: number, requested: number }}
 */
async function assertSufficientStock(prisma, items) {
    const needed = new Map();
    for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.qty);
        if (!productId || !(qty > 0)) continue;
        needed.set(productId, (needed.get(productId) || 0) + qty);
    }

    for (const [productId, requested] of needed) {
        const stock = await getProductStock(prisma, productId);
        if (stock.balance < requested) {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: { name: true },
            });
            const name = product?.name || `Product #${productId}`;
            const error = new Error(
                `Insufficient stock for "${name}". Available: ${stock.balance}, requested: ${requested}`
            );
            error.status = 400;
            error.productId = productId;
            error.available = stock.balance;
            error.requested = requested;
            throw error;
        }
    }
}

module.exports = { getProductStock, assertSufficientStock };
