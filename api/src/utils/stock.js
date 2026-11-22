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

/**
 * Stock check for editing a SALE: on-hand currently already deducts this invoice,
 * so add back the invoice's existing sold qty before comparing to the new request.
 */
async function assertSufficientStockForSaleEdit(prisma, items, excludeInvoiceId) {
    const needed = new Map();
    for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.qty);
        if (!productId || !(qty > 0)) continue;
        needed.set(productId, (needed.get(productId) || 0) + qty);
    }

    const existingLines = await prisma.invoiceItem.findMany({
        where: { invoiceId: Number(excludeInvoiceId), invoice: { type: 'SALE' } },
        select: { productId: true, qty: true },
    });
    const oldQty = new Map();
    for (const line of existingLines) {
        const pid = line.productId;
        oldQty.set(pid, (oldQty.get(pid) || 0) + Number(line.qty || 0));
    }

    for (const [productId, requested] of needed) {
        const stock = await getProductStock(prisma, productId);
        const available = stock.balance + (oldQty.get(productId) || 0);
        if (available + 0.0001 < requested) {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: { name: true },
            });
            const name = product?.name || `Product #${productId}`;
            const error = new Error(
                `Insufficient stock for "${name}". Available: ${Number(available.toFixed(4))}, requested: ${requested}`
            );
            error.status = 400;
            error.productId = productId;
            error.available = available;
            error.requested = requested;
            throw error;
        }
    }
}

/**
 * Stock check for editing a PURCHASE: reducing qty must not push on-hand below zero.
 * Current balance already includes this invoice's purchase qty.
 */
async function assertSufficientStockForPurchaseEdit(prisma, items, excludeInvoiceId) {
    const newQty = new Map();
    for (const item of items) {
        const productId = Number(item.productId);
        const qty = Number(item.qty);
        if (!productId || !(qty > 0)) continue;
        newQty.set(productId, (newQty.get(productId) || 0) + qty);
    }

    const existingLines = await prisma.invoiceItem.findMany({
        where: { invoiceId: Number(excludeInvoiceId), invoice: { type: 'PURCHASE' } },
        select: { productId: true, qty: true },
    });
    const oldQty = new Map();
    for (const line of existingLines) {
        const pid = line.productId;
        oldQty.set(pid, (oldQty.get(pid) || 0) + Number(line.qty || 0));
    }

    const productIds = new Set([...oldQty.keys(), ...newQty.keys()]);
    for (const productId of productIds) {
        const reduction =
            (oldQty.get(productId) || 0) - (newQty.get(productId) || 0);
        if (reduction <= 0) continue;
        const stock = await getProductStock(prisma, productId);
        if (stock.balance + 0.0001 < reduction) {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: { name: true },
            });
            const name = product?.name || `Product #${productId}`;
            const error = new Error(
                `Cannot reduce purchase of "${name}" by ${Number(reduction.toFixed(4))}; only ${Number(stock.balance.toFixed(4))} remain in stock`
            );
            error.status = 400;
            error.productId = productId;
            error.available = stock.balance;
            error.requested = reduction;
            throw error;
        }
    }
}

module.exports = {
    getProductStock,
    assertSufficientStock,
    assertSufficientStockForSaleEdit,
    assertSufficientStockForPurchaseEdit,
};
