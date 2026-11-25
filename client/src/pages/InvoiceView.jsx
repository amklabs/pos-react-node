// src/pages/InvoiceView.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { STORE_NAME } from '../constants/store.js';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate, formatDateTime } from '../utils/formaters.js';
import { useAuthContext } from '../context/AuthContext';
import { isSuperAdmin} from '../utils/roles';

function money(value) {
    return `Rs. ${formatNumber(value)}`;
}

function typeLabel(type) {
    if (type === 'PURCHASE') return 'Purchase Invoice';
    if (type === 'RETURN') return 'Stock Return';
    return 'Sale Invoice';
}

function PaymentBadge({ status }) {
    const s = status || 'Pending';
    const styles =
        s === 'Paid'
            ? 'bg-green-100 text-green-800 border-green-200'
            : s === 'PartialPaid'
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-red-50 text-red-700 border-red-200';
    const label = s === 'PartialPaid' ? 'Partial Paid' : s;
    return (
        <span
            className={`inline-block px-2.5 py-0.5 rounded border text-xs font-bold ${styles}`}
        >
            {label}
        </span>
    );
}

export default function InvoiceView() {
    usePageTitle('Invoice Details');

    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const admin = isSuperAdmin(user);
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);

    console.log(user, admin);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await apiClient.get(`/api/invoices/${id}`);
                if (!cancelled) setInvoice(res.data);
            } catch (err) {
                toastError(err.response?.data?.error || 'Invoice not found');
                if (!cancelled) navigate(-1);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, navigate]);

    const showDiscountCol = useMemo(() => {
        if (!invoice?.items?.length) return false;
        return invoice.items.some((item) => Number(item.discount || 0) !== 0);
    }, [invoice]);

    // Cost / profit is admin-only (hidden for Store Operator on screen and print)
    const showProfit =
        admin && (invoice?.type === 'SALE' || invoice?.type === 'RETURN');

    const lineRows = useMemo(() => {
        if (!invoice?.items) return [];
        return invoice.items.map((item, index) => {
            const qty = Number(item.qty || 0);
            const rate = Number(item.rate || 0);
            const costRate = Number(item.costRate || 0);
            const discount = Number(item.discount || 0);
            const lineTotal = Number(
                (item.lineNet != null
                    ? Number(item.lineNet)
                    : item.total != null
                      ? Number(item.total)
                      : qty * rate - discount
                ).toFixed(2)
            );
            const lineProfit = Number(
                (item.lineProfit != null
                    ? Number(item.lineProfit)
                    : lineTotal - qty * costRate
                ).toFixed(2)
            );
            return {
                key: item.id ?? index,
                sr: index + 1,
                name: item.product?.name || '—',
                company: item.product?.company?.name || null,
                qty,
                rate,
                costRate,
                discount,
                lineTotal,
                lineProfit,
            };
        });
    }, [invoice]);

    const totals = useMemo(() => {
        if (!invoice) return null;
        const subTotal = lineRows.reduce((s, r) => s + r.qty * r.rate, 0);
        const discountTotal = Number(
            invoice.totalDiscount != null
                ? Number(invoice.totalDiscount)
                : lineRows.reduce((s, r) => s + r.discount, 0)
        );
        const grandTotal = Number(invoice.totalAmount || 0);
        const paidAmount = Number(invoice.paidAmount || 0);
        const balanceDue = Number(
            invoice.balanceDue != null
                ? invoice.balanceDue
                : Math.max(0, grandTotal - paidAmount)
        );
        const profit = invoice.profit || null;
        return {
            subTotal: Number(subTotal.toFixed(2)),
            discountTotal: Number(discountTotal.toFixed(2)),
            grandTotal,
            paidAmount,
            balanceDue,
            totalCost: profit ? Number(profit.totalCost) : lineRows.reduce((s, r) => s + r.qty * r.costRate, 0),
            grossProfit: profit
                ? Number(profit.grossProfit)
                : lineRows.reduce((s, r) => s + r.lineProfit, 0),
            signedProfit: profit ? Number(profit.signedProfit) : null,
            marginPct: profit?.marginPct ?? null,
        };
    }, [invoice, lineRows]);

    const receivedPayments = useMemo(() => {
        return (invoice?.payments || []).filter((p) => p.type === 'RECEIVED');
    }, [invoice]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Spinner label="Loading invoice..." />
            </div>
        );
    }

    if (!invoice || !totals) return null;

    const isSale = invoice.type === 'SALE';
    const isPurchase = invoice.type === 'PURCHASE';
    const isReturn = invoice.type === 'RETURN';
    const canEdit =
        (isSale || (isPurchase && admin)) && !isReturn;

    return (
        <div className="w-full min-w-0 max-w-4xl mx-auto">
            {/* Screen actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 print:hidden no-print">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="text-gray-600 hover:underline text-sm"
                >
                    ← Back
                </button>
                <div className="flex gap-2">
                    {canEdit && (
                        <Link to={`/invoice/${id}/edit`} className="btn btn-secondary">
                            Edit invoice
                        </Link>
                    )}
                    <Link to="/invoice-lookup" className="btn btn-secondary">
                        Invoice lookup
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-primary"
                    >
                        Print invoice
                    </button>
                </div>
            </div>

            {/* Printable sheet */}
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow border border-gray-200 print:shadow-none print:border-0 print:rounded-none print:p-0 invoice-print">
                {/* Brand header */}
                <div className="text-center border-b-2 border-gray-900 pb-4 mb-5">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-wide uppercase text-gray-900 leading-snug">
                        {STORE_NAME}
                    </h1>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">
                        {typeLabel(invoice.type)}
                    </p>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="space-y-1">
                        <p>
                            <span className="text-gray-500">Invoice #</span>{' '}
                            <span className="font-bold text-gray-900">
                                {invoice.invoiceNo}
                            </span>
                        </p>
                        <p>
                            <span className="text-gray-500">Date</span>{' '}
                            <span className="font-semibold text-gray-900">
                                {formatDate(invoice.date)}
                            </span>
                        </p>
                        {invoice.sourceInvoice && (
                            <p>
                                <span className="text-gray-500">Against sale</span>{' '}
                                <span className="font-semibold">
                                    #{invoice.sourceInvoice.invoiceNo}
                                </span>
                            </p>
                        )}
                    </div>
                    <div className="text-right space-y-1">
                        {isSale && (
                            <div className="flex justify-end">
                                <PaymentBadge status={invoice.paymentStatus} />
                            </div>
                        )}
                        {invoice.town?.name && (
                            <p>
                                <span className="text-gray-500">Town</span>{' '}
                                <span className="font-semibold">{invoice.town.name}</span>
                            </p>
                        )}
                        {invoice.salesman?.name && (
                            <p>
                                <span className="text-gray-500">Salesman</span>{' '}
                                <span className="font-semibold">
                                    {invoice.salesman.name}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                    <div className="rounded-lg border border-gray-200 p-3 print:border-gray-400">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            {isPurchase ? 'Supplier' : 'Billed to'}
                        </p>
                        {isPurchase ? (
                            <>
                                <span className="font-bold text-base text-gray-900">
                                    {invoice.company?.name || '—'}
                                </span>
                                {invoice.company?.phone ? (
                                    <span className="text-gray-600">({invoice.company.phone})</span>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-base text-gray-900">
                                    {invoice.customer?.name || 'Cash Sale'}
                                </span>
                                {invoice.customer?.phone ? (
                                    <span className="text-gray-600">({invoice.customer.phone})</span>
                                ) : null}
                            </>
                        )}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 print:border-gray-400">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Invoice Summary
                        </p>
                        <span className="text-gray-700">
                            Items:{' '}
                            <span className="font-semibold pe-4">{lineRows.length} </span>
                        </span>
                        <span className="text-gray-700">
                            Qty:{' '}
                            <span className="font-semibold pe-4">
                                {formatNumber(
                                    lineRows.reduce((s, r) => s + r.qty, 0)
                                )}
                            </span>
                        </span>
                        <span className="text-gray-700">
                            Amount:{' '}
                            <span className="font-bold">{money(totals.grandTotal)}</span>
                        </span>
                    </div>
                </div>

                {/* Items */}
                <table className="w-full border-collapse text-sm mb-4">
                    <thead>
                        <tr className="bg-gray-100 print:bg-gray-200">
                            <th className="border border-gray-300 p-1 text-center w-10">
                                #
                            </th>
                            <th className="border border-gray-300 p-1 text-left">
                                Item
                            </th>
                            <th className="border border-gray-300 p-1 text-right w-20">
                                Qty
                            </th>
                            <th className="border border-gray-300 p-1 text-right w-24">
                                Rate
                            </th>
                            {showProfit && (
                                <th className="border border-gray-300 p-1 text-right w-24 print:hidden">
                                    Cost
                                </th>
                            )}
                            {showDiscountCol && (
                                <th className="border border-gray-300 p-1 text-right w-20">
                                    Disc.
                                </th>
                            )}
                            <th className="border border-gray-300 p-1 text-right w-28">
                                Amount
                            </th>
                            {showProfit && (
                                <th className="border border-gray-300 p-1 text-right w-24 print:hidden">
                                    Profit
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {lineRows.map((row) => (
                            <tr key={row.key}>
                                <td className="border border-gray-300 p-1 text-center text-gray-600">
                                    {row.sr}
                                </td>
                                <td className="border border-gray-300 p-1">
                                    <div className="flex flex-row items-center gap-2">
                                        <span className="font-medium">{row.name}</span>
                                        {row.company ? (
                                            <span className="block text-xs text-gray-500">
                                            {row.company}
                                        </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="border border-gray-300 p-1 text-right tabular-nums">
                                    {formatNumber(row.qty)}
                                </td>
                                <td className="border border-gray-300 p-1 text-right tabular-nums">
                                    {formatNumber(row.rate)}
                                </td>
                                {showProfit && (
                                    <td className="border border-gray-300 p-1 text-right tabular-nums print:hidden text-gray-600">
                                        {formatNumber(row.costRate)}
                                    </td>
                                )}
                                {showDiscountCol && (
                                    <td className="border border-gray-300 p-1 text-right tabular-nums">
                                        {formatNumber(row.discount)}
                                    </td>
                                )}
                                <td className="border border-gray-300 p-1 text-right tabular-nums font-semibold">
                                    {formatNumber(row.lineTotal)}
                                </td>
                                {showProfit && (
                                    <td
                                        className={`border border-gray-300 p-1 text-right tabular-nums font-semibold print:hidden ${
                                            row.lineProfit >= 0
                                                ? 'text-green-700'
                                                : 'text-red-700'
                                        }`}
                                    >
                                        {formatNumber(row.lineProfit)}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                    <div className="w-full max-w-xs text-sm">
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-semibold tabular-nums">
                                {money(totals.subTotal)}
                            </span>
                        </div>
                        {totals.discountTotal > 0 && (
                            <div className="flex justify-between gap-6">
                                <span className="text-gray-600">Discount</span>
                                <span className="font-semibold tabular-nums">
                                    − {money(totals.discountTotal)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between gap-6 border-t-2 border-gray-900">
                            <span className="font-bold text-base">Grand total</span>
                            <span className="font-bold text-base tabular-nums">
                                {money(totals.grandTotal)}
                            </span>
                        </div>

                        {isSale && (
                            <>
                                <div className="flex justify-between gap-6">
                                    <span className="text-gray-600">Paid</span>
                                    <span className="font-semibold tabular-nums text-green-700">
                                        {money(totals.paidAmount)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                    <span className="text-gray-600">Balance due</span>
                                    <span
                                        className={`font-bold tabular-nums ${
                                            totals.balanceDue > 0
                                                ? 'text-red-700'
                                                : 'text-green-700'
                                        }`}
                                    >
                                        {money(totals.balanceDue)}
                                    </span>
                                </div>
                            </>
                        )}

                        {showProfit && (
                            <div className="print:hidden border-t border-dashed border-gray-300 pt-2 mt-2 space-y-1.5">
                                <div className="flex justify-between gap-6">
                                    <span className="text-gray-600">Cost of goods</span>
                                    <span className="font-semibold tabular-nums">
                                        {money(totals.totalCost)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                    <span className="text-gray-600">
                                        {isReturn ? 'Profit reversed' : 'Profit'}
                                    </span>
                                    <span
                                        className={`font-bold tabular-nums ${
                                            (totals.signedProfit ?? totals.grossProfit) >= 0
                                                ? 'text-green-700'
                                                : 'text-red-700'
                                        }`}
                                    >
                                        {money(
                                            totals.signedProfit != null
                                                ? totals.signedProfit
                                                : totals.grossProfit
                                        )}
                                    </span>
                                </div>
                                {totals.marginPct != null && (
                                    <div className="flex justify-between gap-6">
                                        <span className="text-gray-600">Margin</span>
                                        <span className="font-semibold tabular-nums">
                                            {formatNumber(totals.marginPct)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Payments (sale only, if any) */}
                {isSale && receivedPayments.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                            Payments received
                        </h3>
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border border-gray-300 p-1 text-left">
                                        Date
                                    </th>
                                    <th className="border border-gray-300 p-1 text-left">
                                        Note
                                    </th>
                                    <th className="border border-gray-300 p-1 text-right">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {receivedPayments.map((p) => (
                                    <tr key={p.id}>
                                        <td className="border border-gray-300 p-1 whitespace-nowrap">
                                            {formatDateTime(p.date)}
                                        </td>
                                        <td className="border border-gray-300 p-1 text-gray-600">
                                            {p.note || '—'}
                                        </td>
                                        <td className="border border-gray-300 p-1 text-right tabular-nums font-semibold">
                                            {formatNumber(p.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Signatures — print focused */}
                <div className="grid grid-cols-2 gap-10 mt-10 pt-4 text-sm">
                    <div className="text-center">
                        <div className="h-10 border-b border-gray-400 mb-1" />
                        <p className="text-gray-600 text-xs uppercase tracking-wide">
                            {isPurchase ? 'Supplier signature' : 'Customer signature'}
                        </p>
                    </div>
                    <div className="text-center">
                        <div className="h-10 border-b border-gray-400 mb-1" />
                        <p className="text-gray-600 text-xs uppercase tracking-wide">
                            Authorized signature
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-3 border-t border-gray-200 text-center text-xs text-gray-500">
                    <p>Thank you for your business.</p>
                    <p className="mt-0.5 font-medium text-gray-600">{STORE_NAME}</p>
                    {(isReturn || isPurchase) && (
                        <p className="mt-1 uppercase tracking-wide">
                            {typeLabel(invoice.type)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
