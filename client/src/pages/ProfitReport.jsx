// src/pages/ProfitReport.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import Pagination from '../components/Pagination.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate, toInputDate } from '../utils/formaters.js';
import { STORE_NAME } from '../constants/store.js';

const PAGE_SIZE = 20;

function money(value) {
    return `Rs. ${formatNumber(value)}`;
}

function startOfMonth(d = new Date()) {
    return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function ProfitReport() {
    usePageTitle('Profit Report');

    const [fromDate, setFromDate] = useState(() => startOfMonth());
    const [toDate, setToDate] = useState(() => toInputDate(new Date()));
    const [invoices, setInvoices] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [pageNetProfit, setPageNetProfit] = useState(0);

    const debouncedSearch = useDebouncedValue(search, 350);

    const fetchReport = useCallback(
        async ({
            from = fromDate,
            to = toDate,
            pageArg = page,
            q = debouncedSearch,
            type = typeFilter,
        } = {}) => {
            try {
                setLoading(true);
                const res = await apiClient.get('/api/reports/profit', {
                    params: {
                        from: from || undefined,
                        to: to || undefined,
                        page: pageArg,
                        pageSize: PAGE_SIZE,
                        q: q.trim() || undefined,
                        type: type !== 'all' ? type : undefined,
                    },
                });
                setInvoices(res.data.invoices || []);
                setSummary(res.data.summary || null);
                setTotal(res.data.total || 0);
                setTotalPages(res.data.totalPages || 1);
                setPageNetProfit(Number(res.data.pageNetProfit || 0));
                setHasLoaded(true);
            } catch (err) {
                toastError(err.response?.data?.error || 'Error fetching profit report');
            } finally {
                setLoading(false);
            }
        },
        [fromDate, toDate, page, debouncedSearch, typeFilter]
    );

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
        setPage(1);
        fetchReport({ from, to, pageArg: 1 });
    };

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, typeFilter, fromDate, toDate]);

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
                    <h1 className="text-2xl font-bold">Profit Report</h1>
                    <p className="text-sm text-gray-500">
                        Profit uses purchase cost snapped on each sale line. Returns reverse earned margin.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-secondary btn-outline"
                        disabled={!hasLoaded || loading}
                    >
                        Print
                    </button>
                    <button
                        type="button"
                        onClick={() => fetchReport()}
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="hidden print:block mb-4 text-center border-b pb-3">
                <h1 className="text-xl font-bold uppercase">{STORE_NAME}</h1>
                <p className="font-semibold">Profit Report</p>
                <p className="text-sm text-gray-600">{periodLabel}</p>
            </div>

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
                    <div className="flex-1 min-w-40">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Search
                        </label>
                        <input
                            type="search"
                            className="border p-1.5 rounded-input w-full text-sm"
                            placeholder="Invoice, customer, town…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Type
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-28"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <option value="all">All types</option>
                            <option value="SALE">Sales only</option>
                            <option value="RETURN">Returns only</option>
                        </select>
                    </div>
                </div>
            </div>

            {hasLoaded && !loading && summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
                    <SummaryCard
                        label="Sales"
                        value={formatNumber(summary.saleCount, {
                            maximumFractionDigits: 0,
                        })}
                        theme="sky"
                    />
                    <SummaryCard
                        label="Sale net"
                        value={money(summary.saleNet)}
                        theme="blue"
                    />
                    <SummaryCard
                        label="Sale cost"
                        value={money(summary.saleCost)}
                        theme="amber"
                    />
                    <SummaryCard
                        label="Sale profit"
                        value={money(summary.saleProfit)}
                        theme="teal"
                    />
                    <SummaryCard
                        label="Net profit"
                        value={money(summary.netProfit)}
                        theme={Number(summary.netProfit) >= 0 ? 'emerald' : 'rose'}
                        hint={
                            summary.marginPct != null
                                ? `Margin ${formatNumber(summary.marginPct)}% · Returns reversed ${money(summary.returnProfitReversed)}`
                                : `Returns reversed ${money(summary.returnProfitReversed)}`
                        }
                    />
                </div>
            )}

            {loading && (
                <div className="py-16">
                    <Spinner size="md" label="Loading profit report..." />
                </div>
            )}

            {!loading && hasLoaded && invoices.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
                    No sales or returns found for this period / filters.
                </div>
            )}

            {!loading && invoices.length > 0 && (
                <>
                    <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
                        <table className="w-full border-collapse text-sm text-left">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2.5 border">Date</th>
                                    <th className="p-2.5 border">Invoice #</th>
                                    <th className="p-2.5 border">Type</th>
                                    <th className="p-2.5 border">Customer</th>
                                    <th className="p-2.5 border text-right">Purchase Amount</th>
                                    <th className="p-2.5 border text-right">Sale Amount</th>
                                    {/*<th className="p-2.5 border text-right">Gross profit</th>*/}
                                    <th className="p-2.5 border text-right">Gross Profit</th>
                                    <th className="p-2.5 border text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
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
                                        <td className="p-2.5 border">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    inv.type === 'RETURN'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                }`}
                                            >
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="p-2.5 border">{inv.customerName}</td>

                                        <td className="p-2.5 border text-right tabular-nums">
                                            {formatNumber(inv.totalCost)}
                                        </td>
                                        <td className="p-2.5 border text-right tabular-nums">
                                            {formatNumber(inv.netSales)}
                                        </td>
                                        {/*<td className="p-2.5 border text-right tabular-nums font-semibold">*/}
                                        {/*    {formatNumber(inv.grossProfit)}*/}
                                        {/*</td>*/}
                                        <td
                                            className={`p-2.5 border text-right tabular-nums font-semibold ${
                                                Number(inv.signedProfit) >= 0
                                                    ? 'text-green-700'
                                                    : 'text-red-700'
                                            }`}
                                        >
                                            {formatNumber(inv.signedProfit)}
                                        </td>
                                        <td className={`p-2.5 border text-right tabular-nums`}>
                                            {inv.marginPct != null
                                                ? `${formatNumber(inv.marginPct)}%`
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold">
                                <tr>
                                    <td className="p-2.5 border" colSpan={6}>
                                        Page-wise Profit Sub Total ({invoices.length} of {total})
                                    </td>
                                    <td
                                        className={`p-2.5 border text-right tabular-nums ${
                                            pageNetProfit >= 0
                                                ? 'text-green-700'
                                                : 'text-red-700'
                                        }`}
                                    >
                                        {formatNumber(pageNetProfit)}
                                    </td>
                                    <td className="p-2.5 border" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                        disabled={loading}
                    />
                </>
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
    amber: {
        card: 'from-amber-50 via-white to-white border-amber-200',
        bar: 'from-amber-500 to-orange-500',
        label: 'text-amber-800',
        value: 'text-slate-900',
        glow: 'bg-amber-400/30',
    },
    teal: {
        card: 'from-teal-50 via-white to-white border-teal-200',
        bar: 'from-teal-500 to-cyan-600',
        label: 'text-teal-700',
        value: 'text-slate-900',
        glow: 'bg-teal-400/25',
    },
    emerald: {
        card: 'from-emerald-50 via-white to-white border-emerald-200',
        bar: 'from-emerald-500 to-teal-600',
        label: 'text-emerald-700',
        value: 'text-emerald-800',
        glow: 'bg-emerald-400/25',
    },
    rose: {
        card: 'from-rose-50 via-white to-white border-rose-200',
        bar: 'from-rose-500 to-red-600',
        label: 'text-rose-700',
        value: 'text-rose-800',
        glow: 'bg-rose-400/25',
    },
};

function SummaryCard({ label, value, hint, theme = 'sky' }) {
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
            {hint ? (
                <p className="relative mt-1 text-[11px] text-slate-500 leading-snug">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
