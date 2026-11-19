const PAYMENT_STATUS = {
    PENDING: 'Pending',
    PARTIAL: 'PartialPaid',
    PAID: 'Paid',
};

/**
 * Recompute SALE invoice paymentStatus / paidOn from linked RECEIVED cash.
 * @param {import('../../generated/prisma').Prisma.TransactionClient | object} tx
 * @param {number} invoiceId
 */
async function recomputeInvoicePayment(tx, invoiceId) {
    const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, type: true, totalAmount: true },
    });
    if (!invoice || invoice.type !== 'SALE') return null;

    const paidAgg = await tx.cashRecord.aggregate({
        _sum: { amount: true },
        where: { invoiceId, type: 'RECEIVED' },
    });

    const paid = Number(paidAgg._sum.amount || 0);
    const total = Number(invoice.totalAmount);

    let paymentStatus = PAYMENT_STATUS.PENDING;
    let paidOn = null;

    if (paid > 0 && paid + 0.001 >= total) {
        paymentStatus = PAYMENT_STATUS.PAID;
        paidOn = new Date();
    } else if (paid > 0) {
        paymentStatus = PAYMENT_STATUS.PARTIAL;
    }

    return tx.invoice.update({
        where: { id: invoiceId },
        data: { paymentStatus, paidOn },
    });
}

module.exports = { PAYMENT_STATUS, recomputeInvoicePayment };
