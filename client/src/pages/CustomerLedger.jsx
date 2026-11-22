// src/pages/CustomerLedger.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft, Printer } from 'lucide-react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { formatNumber, formatDate } from '../utils/formaters.js';
import { toastError } from '../utils/toast';
import { STORE_NAME } from '../constants/store.js';

const TYPE_STYLES = {
    SALE: 'bg-rose-100 text-rose-800 border-rose-200',
    RETURN: 'bg-sky-100 text-sky-800 border-sky-200',
    RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const SUMMARY_THEMES = {
    rose: {
        card: 'from-rose-50 via-white to-white border-rose-200',
        bar: 'from-rose-500 to-red-600',
        label: 'text-rose-700',
        value: 'text-rose-800',
        glow: 'bg-rose-400/25',
    },
    sky: {
        card: 'from-sky-50 via-white to-white border-sky-200',
        bar: 'from-sky-500 to-blue-600',
        label: 'text-sky-700',
        value: 'text-slate-900',
        glow: 'bg-sky-400/25',
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
    teal: {
        card: 'from-teal-50 via-white to-white border-teal-200',
        bar: 'from-teal-500 to-cyan-600',
        label: 'text-teal-700',
        value: 'text-slate-900',
        glow: 'bg-teal-400/25',
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
                {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {hint ? (
                <p className="relative mt-1 text-[11px] text-slate-500 leading-snug">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

function netTheme(amount) {
    if (amount > 0.001) return 'rose';
    if (amount < -0.001) return 'emerald';
    return 'teal';
}

export default function CustomerLedger() {
    usePageTitle('Customer Ledger');

    const [customers, setCustomers] = useState([]);
    const [totals, setTotals] = useState(null);
    const [search, setSearch] = useState('');
    const [balanceFilter, setBalanceFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await apiClient.get('/api/ledger/customers');
                if (!cancelled) {
                    setCustomers(res.data.customers || []);
                    setTotals(res.data.totals || null);
                }
            } catch (err) {
                if (!cancelled) {
                    toastError(err.response?.data?.error || 'Failed to load customer ledger');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return customers.filter((c) => {
            if (balanceFilter === 'due' && !(c.netPayable > 0.001)) return false;
            if (balanceFilter === 'clear' && Math.abs(c.netPayable) > 0.001) return false;
            if (balanceFilter === 'credit' && !(c.netPayable < -0.001)) return false;

            if (!q) return true;
            return (
                c.name?.toLowerCase().includes(q) ||
                c.phone?.toLowerCase().includes(q) ||
                c.town?.toLowerCase().includes(q)
            );
        });
    }, [customers, search, balanceFilter]);

    const filteredTotals = useMemo(() => {
        return filtered.reduce(
            (acc, c) => {
                acc.totalSales += c.totalSales;
                acc.totalReturns += c.totalReturns;
                acc.totalReceived += c.totalReceived;
                acc.netPayable += c.netPayable;
                if (c.netPayable > 0.001) acc.dueCount += 1;
                return acc;
            },
            {
                totalSales: 0,
                totalReturns: 0,
                totalReceived: 0,
                netPayable: 0,
                dueCount: 0,
            }
        );
    }, [filtered]);

    const openDetail = async (customerId) => {
        setSelectedId(customerId);
        setDetail(null);
        try {
            setDetailLoading(true);
            const res = await apiClient.get(`/api/customers/${customerId}/ledger`);
            setDetail(res.data);
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load ledger detail');
            setSelectedId(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setSelectedId(null);
        setDetail(null);
    };

    if (selectedId) {
        return (
            <div className="w-full min-w-0 max-w-5xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
                    <button
                        type="button"
                        onClick={closeDetail}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                        <ArrowLeft size={16} aria-hidden />
                        Back to customers
                    </button>
                    {detail && (
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="btn btn-secondary inline-flex items-center gap-2"
                        >
                            <Printer size={16} aria-hidden />
                            Print statement
                        </button>
                    )}
                </div>

                {detailLoading && (
                    <div className="min-h-[40vh] flex justify-center items-center">
                        <Spinner size="md" label="Loading ledger..." />
                    </div>
                )}

                {!detailLoading && detail && (
                    <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-0 print:p-0">
                        <div className="text-center border-b-2 border-gray-900 pb-4 mb-5">
                            <h1 className="text-xl sm:text-2xl font-extrabold tracking-wide uppercase text-gray-900">
                                {STORE_NAME}
                            </h1>
                            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">
                                Customer Statement
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-sm">
                            <div className="rounded-lg border border-gray-200 p-3 print:border-gray-400">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                    Customer
                                </p>
                                <p className="font-bold text-base text-gray-900">
                                    {detail.customer?.name}
                                </p>
                                <p className="text-gray-600">
                                    {detail.customer?.phone || '—'}
                                </p>
                                <p className="text-gray-600">
                                    {detail.customer?.town?.name || '—'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 p-3 print:border-gray-400">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                                    Statement
                                </p>
                                <p className="text-gray-700">
                                    Transactions:{' '}
                                    <span className="font-semibold">
                                        {detail.ledger?.length || 0}
                                    </span>
                                </p>
                                <p className="text-gray-700">
                                    Printed:{' '}
                                    <span className="font-semibold">
                                        {formatDate(new Date())}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 print:hidden">
                            <SummaryCard
                                label="Total Sales"
                                value={detail.totalSales}
                                theme="rose"
                            />
                            <SummaryCard
                                label="Total Returns"
                                value={detail.totalReturns}
                                theme="sky"
                            />
                            <SummaryCard
                                label="Cash Received"
                                value={detail.totalReceived}
                                theme="emerald"
                            />
                            <SummaryCard
                                label="Net Payable"
                                value={detail.netPayable}
                                theme={netTheme(detail.netPayable)}
                            />
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-300 mb-6">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2.5 border">Date</th>
                                        <th className="p-2.5 border">Reference</th>
                                        <th className="p-2.5 border">Type</th>
                                        <th className="p-2.5 border text-right">
                                            Debit (Sale)
                                        </th>
                                        <th className="p-2.5 border text-right">Credit</th>
                                        <th className="p-2.5 border text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.ledger.map((row) => (
                                        <tr key={row.id} className="border-b hover:bg-gray-50">
                                            <td className="p-2.5 border whitespace-nowrap">
                                                {formatDate(row.date)}
                                            </td>
                                            <td className="p-2.5 border">
                                                {row.invoiceId &&
                                                (row.type === 'SALE' ||
                                                    row.type === 'RETURN') ? (
                                                    <Link
                                                        to={`/invoice/${row.invoiceId}`}
                                                        className="text-brand-700 hover:underline font-semibold print:text-black print:no-underline"
                                                    >
                                                        {row.ref}
                                                    </Link>
                                                ) : (
                                                    row.ref
                                                )}
                                            </td>
                                            <td className="p-2.5 border">
                                                <span
                                                    className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${
                                                        TYPE_STYLES[row.type] ||
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                    }`}
                                                >
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="p-2.5 border text-right tabular-nums">
                                                {row.debit > 0
                                                    ? formatNumber(row.debit)
                                                    : '—'}
                                            </td>
                                            <td className="p-2.5 border text-right tabular-nums text-emerald-700">
                                                {row.credit > 0
                                                    ? formatNumber(row.credit)
                                                    : '—'}
                                            </td>
                                            <td
                                                className={`p-2.5 border text-right tabular-nums font-bold ${
                                                    row.runningBalance > 0
                                                        ? 'text-rose-600'
                                                        : 'text-emerald-600'
                                                }`}
                                            >
                                                {formatNumber(row.runningBalance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {detail.ledger.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="p-6 text-center text-gray-500"
                                            >
                                                No transactions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap justify-end gap-8 border-t-2 border-gray-900 pt-4">
                            <div className="text-right">
                                <p className="text-gray-500 text-xs uppercase tracking-wide">
                                    Total Debit
                                </p>
                                <p className="font-bold text-lg tabular-nums text-rose-600">
                                    {formatNumber(detail.totalDebit)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500 text-xs uppercase tracking-wide">
                                    Total Credit
                                </p>
                                <p className="font-bold text-lg tabular-nums text-emerald-600">
                                    {formatNumber(detail.totalCredit)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-800 text-xs font-bold uppercase tracking-wide">
                                    Net Payable
                                </p>
                                <p
                                    className={`font-extrabold text-xl tabular-nums ${
                                        detail.netPayable > 0
                                            ? 'text-rose-600'
                                            : 'text-emerald-600'
                                    }`}
                                >
                                    {formatNumber(detail.netPayable)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 ">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold">Customer Ledger</h1>
                    <p className="text-sm text-gray-500">
                        Net payable = Sales − Returns − Cash received
                    </p>
                </div>
            </div>

            <div className="bg-white px-3 py-2.5 rounded-xl shadow-sm border border-gray-200 mb-4 print:hidden">
                <div className="flex flex-wrap xl:flex-nowrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Search
                        </label>
                        <input
                            type="search"
                            placeholder="Name, phone, or town…"
                            className="border p-1.5 rounded-input w-full text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Balance
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-40"
                            value={balanceFilter}
                            onChange={(e) => setBalanceFilter(e.target.value)}
                        >
                            <option value="all">All balances</option>
                            <option value="due">Outstanding (due)</option>
                            <option value="clear">Settled</option>
                            <option value="credit">Customer credit</option>
                        </select>
                    </div>
                </div>
            </div>

            {totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <SummaryCard
                        label="Sales"
                        value={filteredTotals.totalSales}
                        hint={`${filtered.length} customer${filtered.length === 1 ? '' : 's'}`}
                        theme="rose"
                    />
                    <SummaryCard
                        label="Returns"
                        value={filteredTotals.totalReturns}
                        theme="sky"
                    />
                    <SummaryCard
                        label="Received"
                        value={filteredTotals.totalReceived}
                        theme="emerald"
                    />
                    <SummaryCard
                        label="Net Payable"
                        value={filteredTotals.netPayable}
                        hint={
                            filteredTotals.dueCount
                                ? `${filteredTotals.dueCount} with outstanding`
                                : 'All settled / credit'
                        }
                        theme={netTheme(filteredTotals.netPayable)}
                    />
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2.5 border">Customer</th>
                            <th className="p-2.5 border">Phone</th>
                            <th className="p-2.5 border">Town</th>
                            <th className="p-2.5 border text-right">Sales</th>
                            <th className="p-2.5 border text-right">Returns</th>
                            <th className="p-2.5 border text-right">Received</th>
                            <th className="p-2.5 border text-right">Net Payable</th>
                            <th className="p-2.5 border text-center w-28 print:hidden">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="8" className="p-8 text-center text-gray-500">
                                    <Spinner size="md" label="Loading customers..." />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((c) => (
                                <tr
                                    key={c.id}
                                    className="border-b hover:bg-gray-50/80 transition-colors"
                                >
                                    <td className="p-2.5 border font-semibold text-gray-900">
                                        {c.name}
                                    </td>
                                    <td className="p-2.5 border text-gray-600">
                                        {c.phone || '—'}
                                    </td>
                                    <td className="p-2.5 border text-gray-600">
                                        {c.town || '—'}
                                    </td>
                                    <td className="p-2.5 border text-right tabular-nums">
                                        {formatNumber(c.totalSales)}
                                    </td>
                                    <td className="p-2.5 border text-right tabular-nums">
                                        {formatNumber(c.totalReturns)}
                                    </td>
                                    <td className="p-2.5 border text-right tabular-nums text-emerald-700 font-medium">
                                        {formatNumber(c.totalReceived)}
                                    </td>
                                    <td
                                        className={`p-2.5 border text-right tabular-nums font-bold ${
                                            c.netPayable > 0
                                                ? 'text-rose-600'
                                                : c.netPayable < 0
                                                  ? 'text-emerald-600'
                                                  : 'text-gray-700'
                                        }`}
                                    >
                                        {formatNumber(c.netPayable)}
                                    </td>
                                    <td className="p-2.5 border print:hidden">
                                        <div className="flex items-center justify-center">
                                            <button
                                                type="button"
                                                title="View ledger"
                                                onClick={() => openDetail(c.id)}
                                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                                            >
                                                <Eye size={14} aria-hidden />
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan="8"
                                    className="p-6 text-center text-gray-500"
                                >
                                    No customers match your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
