/**
 * Profit helpers. Cost is InvoiceItem.costRate snapped at SALE/RETURN time.
 *
 * lineNet = qty * rate - discount
 * lineCost = qty * costRate
 * lineProfit = lineNet - lineCost
 *
 * SALE contributes +profit; RETURN contributes -profit (reverses earned margin).
 */

function toNum(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function round2(n) {
    return Number((Number(n) || 0).toFixed(2));
}

function lineNet(item) {
    const qty = toNum(item.qty);
    const rate = toNum(item.rate);
    const discount = toNum(item.discount);
    if (item.total != null && item.total !== '') {
        return round2(toNum(item.total));
    }
    return round2(qty * rate - discount);
}

function lineCost(item) {
    return round2(toNum(item.qty) * toNum(item.costRate));
}

function lineProfit(item) {
    return round2(lineNet(item) - lineCost(item));
}

/**
 * @param {'SALE'|'RETURN'|string} type
 * @returns {1|-1|0} sign applied to profit for period totals
 */
function profitSign(type) {
    if (type === 'SALE') return 1;
    if (type === 'RETURN') return -1;
    return 0;
}

function enrichInvoiceItems(items = []) {
    return items.map((item) => {
        const net = lineNet(item);
        const cost = lineCost(item);
        const profit = round2(net - cost);
        return {
            ...item,
            qty: toNum(item.qty),
            rate: toNum(item.rate),
            costRate: toNum(item.costRate),
            discount: toNum(item.discount),
            lineNet: net,
            lineCost: cost,
            lineProfit: profit,
        };
    });
}

function summarizeInvoiceProfit(invoice) {
    const type = invoice?.type || 'SALE';
    const sign = profitSign(type);
    const items = enrichInvoiceItems(invoice?.items || []);
    const netSales = round2(items.reduce((s, i) => s + i.lineNet, 0));
    const totalCost = round2(items.reduce((s, i) => s + i.lineCost, 0));
    const grossProfit = round2(items.reduce((s, i) => s + i.lineProfit, 0));
    const signedProfit = round2(grossProfit * sign);
    const marginPct =
        netSales > 0 ? round2((grossProfit / totalCost) * 100) : null;

    return {
        items,
        netSales,
        totalCost,
        grossProfit,
        signedProfit,
        marginPct,
        profitSign: sign,
    };
}

module.exports = {
    toNum,
    round2,
    lineNet,
    lineCost,
    lineProfit,
    profitSign,
    enrichInvoiceItems,
    summarizeInvoiceProfit,
};
