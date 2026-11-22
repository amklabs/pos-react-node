// src/pages/SalesReport.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate, toInputDate } from '../utils/formaters.js';
import { STORE_NAME } from '../constants/store.js';

function money(value) {
    return `Rs. ${formatNumber(value)}`;
}

function startOfMonth(d = new Date()) {
    return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function PaymentBadge({ status }) {
    const s = status || 'Pending';
    const styles =
        s === 'Paid'
            ? 'bg-green-100 text-green-800'
            : s === 'PartialPaid'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800';
    const label = s === 'PartialPaid' ? 'Partial' : s;
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${styles}`}>
            {label}
        </span>
    );
}

export default function SalesReport() {
    usePageTitle('Sales Report');

    const [fromDate, setFromDate] = useState(() => startOfMonth());
    const [toDate, setToDate] = useState(() => toInputDate(new Date()));
    const [invoices, setInvoices] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [salesmanFilter, setSalesmanFilter] = useState('all');
    const [townFilter, setTownFilter] = useState('all');
    const [viewMode, setViewMode] = useState('invoices'); // lines | invoices

    const fetchReport = useCallback(async (from = fromDate, to = toDate) => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/api/reports/sales`, {
                params: {
                    from: from || undefined,
                    to: to || undefined,
                },
            });
            setInvoices(res.data.invoices || []);
            setSummary(res.data.summary || null);
            setHasLoaded(true);
        } catch (err) {
            toastError(err.response?.data?.error || 'Error fetching sales report');
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    const applyPreset = (preset) => {
        const today = new Date();
        let from = '';
        let to = '';
        if (preset === 'today') {
            from = toInputDate(today);
            to = from;
        } else if (preset === '7d') {
            const start = new Date(today);
            start.setDate(start.getDate() - 6);
            from = toInputDate(start);
            to = toInputDate(today);
        } else if (preset === 'month') {
            from = startOfMonth(today);
            to = toInputDate(today);
        }
        setFromDate(from);
        setToDate(to);
        fetchReport(from, to);
    };

    useEffect(() => {
        fetchReport(fromDate, toDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const salesmen = useMemo(() => {
        const map = new Map();
        for (const inv of invoices) {
            if (inv.salesmanId) map.set(inv.salesmanId, inv.salesmanName);
        }
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [invoices]);

    const towns = useMemo(() => {
        const map = new Map();
        for (const inv of invoices) {
            if (inv.townId) map.set(inv.townId, inv.townName);
        }
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [invoices]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return invoices.filter((inv) => {
            if (paymentFilter !== 'all' && (inv.paymentStatus || 'Pending') !== paymentFilter) {
                return false;
            }
            if (
                salesmanFilter !== 'all' &&
                String(inv.salesmanId || '') !== String(salesmanFilter)
            ) {
                return false;
            }
            if (townFilter !== 'all' && String(inv.townId || '') !== String(townFilter)) {
                return false;
            }
            if (!q) return true;
            const hay = [
                inv.invoiceNo,
                inv.customerName,
                inv.salesmanName,
                inv.townName,
                ...(inv.items || []).map((i) => i.productName),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [invoices, search, paymentFilter, salesmanFilter, townFilter]);

    const filteredSummary = useMemo(() => {
        return filtered.reduce(
            (acc, inv) => {
                acc.invoiceCount += 1;
                acc.totalAmount += Number(inv.totalAmount || 0);
                acc.totalDiscount += Number(inv.totalDiscount || 0);
                acc.paidAmount += Number(inv.paidAmount || 0);
                acc.balanceDue += Number(inv.balanceDue || 0);
                for (const item of inv.items || []) {
                    acc.lineCount += 1;
                    acc.totalQty += Number(item.qty || 0);
                }
                return acc;
            },
            {
                invoiceCount: 0,
                lineCount: 0,
                totalQty: 0,
                totalAmount: 0,
                totalDiscount: 0,
                paidAmount: 0,
                balanceDue: 0,
            }
        );
    }, [filtered]);

    const periodLabel = useMemo(() => {
        if (fromDate && toDate) return `${formatDate(fromDate)} – ${formatDate(toDate)}`;
        if (fromDate) return `From ${formatDate(fromDate)}`;
        if (toDate) return `Until ${formatDate(toDate)}`;
        return 'All dates';
    }, [fromDate, toDate]);

    return (
        <div className="w-full min-w-0">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">Sales Report</h1>
                    <p className="text-sm text-gray-500">
                        Line-level sales with payment status, filters, and period totals
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => fetchReport()}
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Loading…' : 'Generate'}
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-secondary"
                        disabled={!hasLoaded || loading}
                    >
                        Print
                    </button>
                </div>
            </div>

            {/* Print header */}
            <div className="hidden print:block mb-4 text-center border-b pb-3">
                <h1 className="text-xl font-bold uppercase">{STORE_NAME}</h1>
                <p className="font-semibold">Sales Report</p>
                <p className="text-sm text-gray-600">{periodLabel}</p>
            </div>

            {/* Filters */}
            <div className="bg-white px-3 py-2.5 rounded-xl shadow-sm border border-gray-200 mb-4 print:hidden">
                <div className="flex flex-wrap xl:flex-nowrap items-end gap-2">
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            From
                        </label>
                        <DateField
                            value={fromDate}
                            onChange={setFromDate}
                            max={toDate || undefined}
                            className="w-36"
                        />
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            To
                        </label>
                        <DateField
                            value={toDate}
                            onChange={setToDate}
                            min={fromDate || undefined}
                            className="w-36"
                        />
                    </div>
                    <div className="flex items-center gap-1 pb-0.5 shrink-0">
                        {[
                            ['today', 'Today'],
                            ['7d', '7 days'],
                            ['month', 'Month'],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                className="btn btn-secondary text-xs px-2.5 py-1.5"
                                onClick={() => applyPreset(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-w-[9rem]">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Search
                        </label>
                        <input
                            type="search"
                            className="border p-1.5 rounded-input w-full text-sm"
                            placeholder="Invoice, customer, product…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Payment
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-24"
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="Paid">Paid</option>
                            <option value="PartialPaid">Partial</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Salesman
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-28"
                            value={salesmanFilter}
                            onChange={(e) => setSalesmanFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            {salesmen.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Town
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-24"
                            value={townFilter}
                            onChange={(e) => setTownFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            {towns.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            View
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-28"
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value)}
                        >
                            <option value="lines">Line items</option>
                            <option value="invoices">Invoices</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary */}
            {hasLoaded && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                    <SummaryCard
                        label="Invoices"
                        value={formatNumber(filteredSummary.invoiceCount, {
                            maximumFractionDigits: 0,
                        })}
                        theme="sky"
                    />
                    <SummaryCard
                        label="Qty sold"
                        value={formatNumber(filteredSummary.totalQty)}
                        theme="blue"
                    />
                    <SummaryCard
                        label="Gross sales"
                        value={money(filteredSummary.totalAmount)}
                        theme="teal"
                    />
                    <SummaryCard
                        label="Discount"
                        value={money(filteredSummary.totalDiscount)}
                        theme="violet"
                    />
                    <SummaryCard
                        label="Collected"
                        value={money(filteredSummary.paidAmount)}
                        theme="emerald"
                    />
                    <SummaryCard
                        label="Outstanding"
                        value={money(filteredSummary.balanceDue)}
                        theme={
                            Number(filteredSummary.balanceDue) > 0 ? 'amber' : 'emerald'
                        }
                    />
                </div>
            )}

            {loading && (
                <div className="py-16">
                    <Spinner size="md" label="Loading sales report..." />
                </div>
            )}

            {!loading && hasLoaded && filtered.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
                    No sales found for this period / filters.
                </div>
            )}

            {!loading && filtered.length > 0 && viewMode === 'invoices' && (
                <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
                    <table className="w-full border-collapse text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2.5 border">Date</th>
                                <th className="p-2.5 border">Invoice #</th>
                                <th className="p-2.5 border">Customer</th>
                                <th className="p-2.5 border">Town</th>
                                <th className="p-2.5 border">Salesman</th>
                                <th className="p-2.5 border text-right">Amount</th>
                                <th className="p-2.5 border text-right">Paid</th>
                                <th className="p-2.5 border text-right">Balance</th>
                                <th className="p-2.5 border">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((inv) => (
                                <tr key={inv.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2.5 border whitespace-nowrap">
                                        {formatDate(inv.date)}
                                    </td>
                                    <td className="p-2.5 border font-semibold">
                                        <Link
                                            to={`/invoice/${inv.id}`}
                                            className="text-brand-700 hover:underline"
                                        >
                                            #{inv.invoiceNo}
                                        </Link>
                                    </td>
                                    <td className="p-2.5 border">{inv.customerName}</td>
                                    <td className="p-2.5 border">{inv.townName || '—'}</td>
                                    <td className="p-2.5 border">{inv.salesmanName || '—'}</td>
                                    <td className="p-2.5 border text-right tabular-nums font-semibold">
                                        {formatNumber(inv.totalAmount)}
                                    </td>
                                    <td className="p-2.5 border text-right tabular-nums">
                                        {formatNumber(inv.paidAmount)}
                                    </td>
                                    <td className="p-2.5 border text-right tabular-nums">
                                        {formatNumber(inv.balanceDue)}
                                    </td>
                                    <td className="p-2.5 border">
                                        <PaymentBadge status={inv.paymentStatus} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                                <td className="p-2.5 border" colSpan={5}>
                                    Totals ({filteredSummary.invoiceCount} invoices)
                                </td>
                                <td className="p-2.5 border text-right tabular-nums">
                                    {formatNumber(filteredSummary.totalAmount)}
                                </td>
                                <td className="p-2.5 border text-right tabular-nums">
                                    {formatNumber(filteredSummary.paidAmount)}
                                </td>
                                <td className="p-2.5 border text-right tabular-nums">
                                    {formatNumber(filteredSummary.balanceDue)}
                                </td>
                                <td className="p-2.5 border" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {!loading && filtered.length > 0 && viewMode === 'lines' && (
                <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
                    <table className="w-full border-collapse text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2.5 border">Date</th>
                                <th className="p-2.5 border">Invoice #</th>
                                <th className="p-2.5 border">Customer</th>
                                <th className="p-2.5 border">Salesman</th>
                                <th className="p-2.5 border">Product</th>
                                <th className="p-2.5 border text-right">Qty</th>
                                <th className="p-2.5 border text-right">Rate</th>
                                <th className="p-2.5 border text-right">Disc.</th>
                                <th className="p-2.5 border text-right">Line total</th>
                                <th className="p-2.5 border">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((invoice) =>
                                (invoice.items || []).map((item, idx) => (
                                    <tr
                                        key={`${invoice.id}-${item.id}`}
                                        className="border-b hover:bg-gray-50"
                                    >
                                        {idx === 0 && (
                                            <>
                                                <td
                                                    className="p-2.5 border whitespace-nowrap align-top"
                                                    rowSpan={invoice.items.length}
                                                >
                                                    {formatDate(invoice.date)}
                                                </td>
                                                <td
                                                    className="p-2.5 border font-semibold align-top"
                                                    rowSpan={invoice.items.length}
                                                >
                                                    <Link
                                                        to={`/invoice/${invoice.id}`}
                                                        className="text-brand-700 hover:underline"
                                                    >
                                                        #{invoice.invoiceNo}
                                                    </Link>
                                                </td>
                                                <td
                                                    className="p-2.5 border align-top"
                                                    rowSpan={invoice.items.length}
                                                >
                                                    <div className="font-medium">
                                                        {invoice.customerName}
                                                    </div>
                                                    {invoice.townName ? (
                                                        <div className="text-xs text-gray-500">
                                                            {invoice.townName}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td
                                                    className="p-2.5 border align-top"
                                                    rowSpan={invoice.items.length}
                                                >
                                                    {invoice.salesmanName || '—'}
                                                </td>
                                            </>
                                        )}
                                        <td className="p-2.5 border">
                                            {item.productName}
                                            {item.companyName ? (
                                                <span className="block text-xs text-gray-500">
                                                    {item.companyName}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="p-2.5 border text-right tabular-nums">
                                            {formatNumber(item.qty)}
                                        </td>
                                        <td className="p-2.5 border text-right tabular-nums">
                                            {formatNumber(item.rate)}
                                        </td>
                                        <td className="p-2.5 border text-right tabular-nums">
                                            {formatNumber(item.discount)}
                                        </td>
                                        <td className="p-2.5 border text-right tabular-nums font-semibold">
                                            {formatNumber(item.lineTotal)}
                                        </td>
                                        {idx === 0 && (
                                            <td
                                                className="p-2.5 border align-top"
                                                rowSpan={invoice.items.length}
                                            >
                                                <PaymentBadge status={invoice.paymentStatus} />
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                                <td className="p-2.5 border" colSpan={5}>
                                    Totals ({filteredSummary.invoiceCount} invoices ·{' '}
                                    {filteredSummary.lineCount} lines)
                                </td>
                                <td className="p-2.5 border text-right tabular-nums">
                                    {formatNumber(filteredSummary.totalQty)}
                                </td>
                                <td className="p-2.5 border" colSpan={2} />
                                <td className="p-2.5 border text-right tabular-nums">
                                    {formatNumber(filteredSummary.totalAmount)}
                                </td>
                                <td className="p-2.5 border" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {!loading && hasLoaded && summary && (
                <p className="mt-3 text-xs text-gray-500 print:hidden">
                    Showing {filtered.length} of {invoices.length} invoices · {periodLabel}
                    {summary.pendingCount != null
                        ? ` · Paid ${summary.paidCount} · Partial ${summary.partialCount} · Pending ${summary.pendingCount}`
                        : ''}
                </p>
            )}
        </div>
    );
}

const SUMMARY_THEMES = {
    sky: {
        card: 'from-sky-50 via-white to-white border-sky-200',
        bar: 'from-sky-500 to-blue-600',
        label: 'text-sky-700',
        value: 'text-slate-900',
        glow: 'bg-sky-400/25',
    },
    blue: {
        card: 'from-blue-50 via-white to-white border-blue-200',
        bar: 'from-blue-500 to-indigo-600',
        label: 'text-blue-700',
        value: 'text-slate-900',
        glow: 'bg-blue-400/25',
    },
    teal: {
        card: 'from-teal-50 via-white to-white border-teal-200',
        bar: 'from-teal-500 to-cyan-600',
        label: 'text-teal-700',
        value: 'text-slate-900',
        glow: 'bg-teal-400/25',
    },
    violet: {
        card: 'from-violet-50 via-white to-white border-violet-200',
        bar: 'from-violet-500 to-purple-600',
        label: 'text-violet-700',
        value: 'text-slate-900',
        glow: 'bg-violet-400/25',
    },
    emerald: {
        card: 'from-emerald-50 via-white to-white border-emerald-200',
        bar: 'from-emerald-500 to-teal-600',
        label: 'text-emerald-700',
        value: 'text-emerald-800',
        glow: 'bg-emerald-400/25',
    },
    amber: {
        card: 'from-amber-50 via-white to-white border-amber-200',
        bar: 'from-amber-500 to-orange-500',
        label: 'text-amber-800',
        value: 'text-amber-900',
        glow: 'bg-amber-400/30',
    },
};

function SummaryCard({ label, value, theme = 'sky' }) {
    const t = SUMMARY_THEMES[theme] || SUMMARY_THEMES.sky;
    return (
        <div
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${t.card} px-3 py-3 shadow-sm`}
        >
            <div
                className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl ${t.glow}`}
            />
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} />
            <p
                className={`relative text-[11px] font-bold uppercase tracking-wider ${t.label}`}
            >
                {label}
            </p>
            <p
                className={`relative mt-1.5 text-lg font-extrabold tabular-nums break-all ${t.value}`}
            >
                {value}
            </p>
        </div>
    );
}
