// src/pages/StockReport.jsx
import { useState, useEffect, useMemo } from 'react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { toastError } from '../utils/toast';
import { formatNumber } from '../utils/formaters.js';

export default function StockReport() {
    usePageTitle('Stock Report');

    const [items, setItems] = useState([]);
    const [totals, setTotals] = useState(null);
    const [lowStockThreshold, setLowStockThreshold] = useState(10);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all'); // all | low | out | in
    const [showInactive, setShowInactive] = useState(false);
    const [sortBy, setSortBy] = useState('name'); // name | balance | value

    const fetchStock = async (inactive = showInactive) => {
        try {
            setLoading(true);
            const res = await apiClient.get('/api/reports/stock', {
                params: {
                    showInactive: inactive ? 'true' : 'false',
                    lowStockThreshold,
                },
            });
            setItems(res.data.items || []);
            setTotals(res.data.totals || null);
            if (res.data.lowStockThreshold != null) {
                setLowStockThreshold(res.data.lowStockThreshold);
            }
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load stock report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock(showInactive);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showInactive]);

    const companies = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            if (item.companyId) map.set(item.companyId, item.companyName);
        }
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = items.filter((item) => {
            if (companyFilter !== 'all' && String(item.companyId) !== String(companyFilter)) {
                return false;
            }
            if (statusFilter === 'low' && !item.isLowStock) return false;
            if (statusFilter === 'out' && !item.isOutOfStock) return false;
            if (statusFilter === 'in' && item.balanceQty <= 0) return false;
            if (!q) return true;
            return (
                item.name?.toLowerCase().includes(q) ||
                item.companyName?.toLowerCase().includes(q)
            );
        });

        rows = [...rows].sort((a, b) => {
            if (sortBy === 'balance') return a.balanceQty - b.balanceQty;
            if (sortBy === 'value') return b.stockValue - a.stockValue;
            return (a.name || '').localeCompare(b.name || '');
        });

        return rows;
    }, [items, search, companyFilter, statusFilter, sortBy]);

    const filteredTotals = useMemo(() => {
        return filtered.reduce(
            (acc, row) => {
                acc.balanceQty += row.balanceQty;
                acc.stockValue += row.stockValue;
                if (row.isLowStock) acc.lowStockCount += 1;
                if (row.isOutOfStock) acc.outOfStockCount += 1;
                return acc;
            },
            { balanceQty: 0, stockValue: 0, lowStockCount: 0, outOfStockCount: 0 }
        );
    }, [filtered]);

    return (
        <div className="w-full min-w-0">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">Stock Report</h1>
                    <p className="text-sm text-gray-500">
                        Balance = Purchased − Sold + Returned · Value uses last purchase rate
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => fetchStock(showInactive)}
                        className="bg-blue-600 text-white px-4 py-2 rounded font-semibold"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="bg-gray-800 text-white px-4 py-2 rounded font-semibold"
                    >
                        Print
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white px-3 py-2.5 rounded-xl shadow-sm border border-gray-200 mb-4 print:hidden">
                <div className="flex flex-wrap xl:flex-nowrap items-end gap-2">
                    <div className="flex-1 min-w-[10rem]">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Search
                        </label>
                        <input
                            type="search"
                            className="border p-1.5 rounded-input w-full text-sm"
                            placeholder="Product or company…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Company
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-36"
                            value={companyFilter}
                            onChange={(e) => setCompanyFilter(e.target.value)}
                        >
                            <option value="all">All companies</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Status
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-28"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="in">In stock</option>
                            <option value="low">Low stock</option>
                            <option value="out">Out of stock</option>
                        </select>
                    </div>
                    <div className="shrink-0">
                        <label className="block text-[11px] font-semibold mb-0.5 text-gray-600">
                            Sort
                        </label>
                        <select
                            className="border p-1.5 rounded-input text-sm min-w-36"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="name">Name</option>
                            <option value="balance">Balance (low first)</option>
                            <option value="value">Value (high first)</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm h-[34px] cursor-pointer shrink-0 select-none">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="cursor-pointer"
                        />
                        Include inactive
                    </label>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <SummaryCard
                    label="Products shown"
                    value={filtered.length}
                    hint={totals ? `${totals.productCount} loaded` : null}
                    theme="sky"
                />
                <SummaryCard
                    label="Balance qty"
                    value={formatNumber(filteredTotals.balanceQty)}
                    theme={filteredTotals.balanceQty < 0 ? 'rose' : 'emerald'}
                />
                <SummaryCard
                    label="Stock value"
                    value={`Rs. ${formatNumber(filteredTotals.stockValue)}`}
                    hint="at last purchase rate"
                    theme="teal"
                />
                <SummaryCard
                    label="Low / Out"
                    value={`${filteredTotals.lowStockCount} / ${filteredTotals.outOfStockCount}`}
                    hint={`Low < ${lowStockThreshold}`}
                    theme={
                        filteredTotals.outOfStockCount > 0 ||
                        filteredTotals.lowStockCount > 0
                            ? 'amber'
                            : 'emerald'
                    }
                />
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
                <table className="w-full bg-white border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-2 border">#</th>
                            <th className="p-2 border">Product</th>
                            <th className="p-2 border">Company</th>
                            <th className="p-2 border text-right">Purchased</th>
                            <th className="p-2 border text-right">Sold</th>
                            <th className="p-2 border text-right">Returned</th>
                            <th className="p-2 border text-right bg-gray-300">Balance</th>
                            <th className="p-2 border text-right">Last P.Rate</th>
                            <th className="p-2 border text-right">Stock Value</th>
                            <th className="p-2 border">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="10" className="p-8 text-center text-gray-500">
                                    <Spinner size="md" label="Loading stock..." />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filtered.map((item, index) => (
                                <tr
                                    key={item.id}
                                    className={`border-b hover:bg-gray-50 ${!item.isActive ? 'opacity-60' : ''}`}
                                >
                                    <td className="p-2 border text-center text-gray-500">
                                        {index + 1}
                                    </td>
                                    <td className="p-2 border font-semibold">
                                        {item.name}
                                        {!item.isActive && (
                                            <span className="ml-2 text-xs text-gray-400">(inactive)</span>
                                        )}
                                    </td>
                                    <td className="p-2 border">{item.companyName || '—'}</td>
                                    <td className="p-2 border text-right text-blue-700">
                                        {item.purchasedQty ? formatNumber(item.purchasedQty) : '—'}
                                    </td>
                                    <td className="p-2 border text-right text-orange-700">
                                        {item.soldQty ? formatNumber(item.soldQty) : '—'}
                                    </td>
                                    <td className="p-2 border text-right text-sky-700">
                                        {item.returnQty ? formatNumber(item.returnQty) : '—'}
                                    </td>
                                    <td
                                        className={`p-2 border text-right font-bold ${
                                            item.balanceQty < 0
                                                ? 'text-red-700'
                                                : item.isLowStock
                                                  ? 'text-amber-600'
                                                  : 'text-green-700'
                                        }`}
                                    >
                                        {formatNumber(item.balanceQty)}
                                    </td>
                                    <td className="p-2 border text-right">
                                        {item.lastPRate ? formatNumber(item.lastPRate) : '—'}
                                    </td>
                                    <td className="p-2 border text-right font-semibold">
                                        {formatNumber(item.stockValue)}
                                    </td>
                                    <td className="p-2 border">
                                        <StatusBadge item={item} />
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan="10" className="p-4 text-center text-gray-500">
                                    No products match your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {!loading && filtered.length > 0 && (
                        <tfoot className="bg-gray-100 font-semibold">
                            <tr>
                                <td className="p-2 border" colSpan="3">
                                    Totals ({filtered.length} products)
                                </td>
                                <td className="p-2 border text-right">
                                    {formatNumber(
                                        filtered.reduce((s, r) => s + r.purchasedQty, 0)
                                    )}
                                </td>
                                <td className="p-2 border text-right">
                                    {formatNumber(filtered.reduce((s, r) => s + r.soldQty, 0))}
                                </td>
                                <td className="p-2 border text-right">
                                    {formatNumber(filtered.reduce((s, r) => s + r.returnQty, 0))}
                                </td>
                                <td className="p-2 border text-right">
                                    {formatNumber(filteredTotals.balanceQty)}
                                </td>
                                <td className="p-2 border"></td>
                                <td className="p-2 border text-right">
                                    {formatNumber(filteredTotals.stockValue)}
                                </td>
                                <td className="p-2 border"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ item }) {
    if (item.isOutOfStock) {
        return (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                Out
            </span>
        );
    }
    if (item.isLowStock) {
        return (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                Low
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
            OK
        </span>
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
    amber: {
        card: 'from-amber-50 via-white to-white border-amber-200',
        bar: 'from-amber-500 to-orange-500',
        label: 'text-amber-800',
        value: 'text-amber-900',
        glow: 'bg-amber-400/30',
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
