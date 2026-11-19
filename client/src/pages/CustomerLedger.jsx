// src/pages/CustomerLedger.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { formatNumber, formatDate } from '../utils/formaters.js';
import { toastError } from '../utils/toast';

const TYPE_STYLES = {
    SALE: 'bg-red-100 text-red-800',
    RETURN: 'bg-blue-100 text-blue-800',
    RECEIVED: 'bg-green-100 text-green-800',
};

export default function CustomerLedger() {
    usePageTitle('Customer Ledger');

    const [customers, setCustomers] = useState([]);
    const [totals, setTotals] = useState(null);
    const [search, setSearch] = useState('');
    const [balanceFilter, setBalanceFilter] = useState('all'); // all | due | clear | credit
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
                return acc;
            },
            { totalSales: 0, totalReturns: 0, totalReceived: 0, netPayable: 0 }
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
            <div className="max-w-5xl">
                <div className="flex items-center justify-between mb-4 print:hidden">
                    <button
                        type="button"
                        onClick={closeDetail}
                        className="text-gray-600 hover:underline"
                    >
                        &larr; Back to customers
                    </button>
                    {detail && (
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-gray-800 text-white px-4 py-2 rounded"
                        >
                            Print Statement
                        </button>
                    )}
                </div>

                {detailLoading && (
                    <div className="min-h-[40vh] flex justify-center items-center">
                        <Spinner size="md" label="Loading ledger..." />
                    </div>
                )}

                {!detailLoading && detail && (
                    <div className="bg-white p-8 rounded shadow print:shadow-none print:p-0">
                        <div className="border-b border-gray-200 pb-4 mb-4">
                            <h1 className="text-2xl font-bold mb-1">Customer Ledger</h1>
                            <h2 className="text-xl font-semibold">{detail.customer?.name}</h2>
                            <p className="text-gray-600">Phone: {detail.customer?.phone || '—'}</p>
                            <p className="text-gray-600">Town: {detail.customer?.town?.name || '—'}</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                            <SummaryCard label="Total Sales" value={detail.totalSales} tone="red" />
                            <SummaryCard label="Total Returns" value={detail.totalReturns} tone="blue" />
                            <SummaryCard label="Cash Received" value={detail.totalReceived} tone="green" />
                            <SummaryCard label="Net Payable" value={detail.netPayable} tone="net" />
                        </div>

                        <table className="w-full mb-8 border-collapse text-left text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 border">Date</th>
                                    <th className="p-2 border">Reference</th>
                                    <th className="p-2 border">Type</th>
                                    <th className="p-2 border text-right">Debit (Sale)</th>
                                    <th className="p-2 border text-right">Credit</th>
                                    <th className="p-2 border text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.ledger.map((row) => (
                                    <tr key={row.id} className="border-b">
                                        <td className="p-2 border">{formatDate(row.date)}</td>
                                        <td className="p-2 border">
                                            {row.invoiceId && (row.type === 'SALE' || row.type === 'RETURN') ? (
                                                <Link
                                                    to={`/invoice/${row.invoiceId}`}
                                                    className="text-blue-600 hover:underline print:text-black print:no-underline"
                                                >
                                                    {row.ref}
                                                </Link>
                                            ) : (
                                                row.ref
                                            )}
                                        </td>
                                        <td className="p-2 border">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_STYLES[row.type] || 'bg-gray-100'}`}
                                            >
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="p-2 border text-right">
                                            {row.debit > 0 ? formatNumber(row.debit) : '—'}
                                        </td>
                                        <td className="p-2 border text-right text-green-700">
                                            {row.credit > 0 ? formatNumber(row.credit) : '—'}
                                        </td>
                                        <td
                                            className={`p-2 border text-right font-bold ${
                                                row.runningBalance > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}
                                        >
                                            {formatNumber(row.runningBalance)}
                                        </td>
                                    </tr>
                                ))}
                                {detail.ledger.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="p-4 text-center text-gray-500">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="flex justify-end gap-10 border-t-2 pt-4">
                            <div className="text-right">
                                <p className="text-gray-500 text-sm">Total Debit</p>
                                <p className="font-bold text-lg text-red-600">
                                    {formatNumber(detail.totalDebit)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-500 text-sm">Total Credit</p>
                                <p className="font-bold text-lg text-green-600">
                                    {formatNumber(detail.totalCredit)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-800 text-sm font-bold">Net Payable</p>
                                <p
                                    className={`font-bold text-xl ${
                                        detail.netPayable > 0 ? 'text-red-600' : 'text-green-600'
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
        <div className="max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Customer Ledger</h1>
                    <p className="text-sm text-gray-500">
                        Net payable = Sales − Returns − Cash received
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                    <input
                        type="search"
                        placeholder="Search name, phone, or town..."
                        className="border p-2 rounded-input w-full sm:w-72"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="border p-2 rounded-input"
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

            {totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <SummaryCard label="Sales (filtered)" value={filteredTotals.totalSales} tone="red" />
                    <SummaryCard label="Returns (filtered)" value={filteredTotals.totalReturns} tone="blue" />
                    <SummaryCard label="Received (filtered)" value={filteredTotals.totalReceived} tone="green" />
                    <SummaryCard label="Net Payable (filtered)" value={filteredTotals.netPayable} tone="net" />
                </div>
            )}

            <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-2 border">Customer</th>
                            <th className="p-2 border">Phone</th>
                            <th className="p-2 border">Town</th>
                            <th className="p-2 border text-right">Sales</th>
                            <th className="p-2 border text-right">Returns</th>
                            <th className="p-2 border text-right">Received</th>
                            <th className="p-2 border text-right">Net Payable</th>
                            <th className="p-2 border print:hidden">Action</th>
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
                                <tr key={c.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 border font-semibold">{c.name}</td>
                                    <td className="p-2 border">{c.phone || '—'}</td>
                                    <td className="p-2 border">{c.town || '—'}</td>
                                    <td className="p-2 border text-right">{formatNumber(c.totalSales)}</td>
                                    <td className="p-2 border text-right">{formatNumber(c.totalReturns)}</td>
                                    <td className="p-2 border text-right text-green-700">
                                        {formatNumber(c.totalReceived)}
                                    </td>
                                    <td
                                        className={`p-2 border text-right font-bold ${
                                            c.netPayable > 0
                                                ? 'text-red-600'
                                                : c.netPayable < 0
                                                  ? 'text-green-600'
                                                  : 'text-gray-700'
                                        }`}
                                    >
                                        {formatNumber(c.netPayable)}
                                    </td>
                                    <td className="p-2 border print:hidden">
                                        <button
                                            type="button"
                                            onClick={() => openDetail(c.id)}
                                            className="text-blue-600 hover:underline text-sm font-semibold"
                                        >
                                            View ledger
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan="8" className="p-4 text-center text-gray-500">
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

function SummaryCard({ label, value, tone }) {
    const color =
        tone === 'red'
            ? 'text-red-600'
            : tone === 'green'
              ? 'text-green-600'
              : tone === 'blue'
                ? 'text-blue-600'
                : value > 0
                  ? 'text-red-600'
                  : 'text-green-600';

    return (
        <div className="bg-white border rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{formatNumber(value)}</p>
        </div>
    );
}
