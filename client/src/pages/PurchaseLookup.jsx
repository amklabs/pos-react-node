// src/pages/PurchaseLookup.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import Pagination from '../components/Pagination.jsx';
import DateField from '../components/DateField.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate } from '../utils/formaters.js';

const PAGE_SIZE = 20;

export default function PurchaseLookup() {
    usePageTitle('Purchase Lookup');

    const [purchases, setPurchases] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState(0);
    const [loading, setLoading] = useState(true);

    const debouncedSearch = useDebouncedValue(searchTerm, 350);

    const fetchPurchases = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/api/invoices', {
                params: {
                    type: 'PURCHASE',
                    page,
                    pageSize: PAGE_SIZE,
                    q: debouncedSearch.trim() || undefined,
                    from: fromDate || undefined,
                    to: toDate || undefined,
                },
            });
            setPurchases(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
            setTotalAmount(Number(res.data.totalAmount || 0));
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load purchases');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, fromDate, toDate]);

    useEffect(() => {
        fetchPurchases();
    }, [fetchPurchases]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, fromDate, toDate]);

    return (
        <div className="w-full min-w-0 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Lookup</h1>
                    <p className="text-sm text-gray-500">
                        {total} purchase{total === 1 ? '' : 's'}
                        {!loading && (
                            <> · Total Rs. {formatNumber(totalAmount)}</>
                        )}
                    </p>
                </div>
                <Link
                    to="/purchase"
                    className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold text-center hover:bg-emerald-700 print:hidden"
                >
                    + New Purchase
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4 print:hidden">
                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold mb-1">Search</label>
                        <input
                            type="search"
                            placeholder="Invoice #, supplier, or town…"
                            className="border p-2 rounded-input w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">From</label>
                        <DateField
                            value={fromDate}
                            onChange={setFromDate}
                            max={toDate || undefined}
                            className="w-44"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">To</label>
                        <DateField
                            value={toDate}
                            onChange={setToDate}
                            min={fromDate || undefined}
                            className="w-44"
                        />
                    </div>
                    {(fromDate || toDate || searchTerm) && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setSearchTerm('');
                                setFromDate('');
                                setToDate('');
                                setPage(1);
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white mb-2">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-2 border">Date</th>
                            <th className="p-2 border">Invoice #</th>
                            <th className="p-2 border">Supplier</th>
                            <th className="p-2 border">Town</th>
                            <th className="p-2 border text-center">Items</th>
                            <th className="p-2 border text-right">Total</th>
                            <th className="p-2 border">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-500">
                                    <Spinner
                                        size="md"
                                        label="Loading purchase invoices..."
                                    />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            purchases.map((inv) => (
                                <tr key={inv.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 border">{formatDate(inv.date)}</td>
                                    <td className="p-2 border font-semibold">
                                        {inv.invoiceNo}
                                    </td>
                                    <td className="p-2 border">
                                        {inv.company?.name || '—'}
                                    </td>
                                    <td className="p-2 border">{inv.town?.name || '—'}</td>
                                    <td className="p-2 border text-center">
                                        {inv.itemCount ?? '—'}
                                    </td>
                                    <td className="p-2 border text-right font-bold">
                                        Rs. {formatNumber(inv.totalAmount)}
                                    </td>
                                    <td className="p-2 border">
                                        <Link
                                            to={`/invoice/${inv.id}`}
                                            className="text-blue-600 hover:underline font-semibold"
                                        >
                                            View / Print
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        {!loading && purchases.length === 0 && (
                            <tr>
                                <td
                                    colSpan="7"
                                    className="p-4 text-center text-gray-500"
                                >
                                    No purchase invoices found.
                                </td>
                            </tr>
                        )}
                    </tbody>
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
        </div>
    );
}
