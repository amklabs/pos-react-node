// src/pages/PurchaseLookup.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate } from '../utils/formaters.js';

export default function PurchaseLookup() {
    usePageTitle('Purchase Lookup');
    const [purchases, setPurchases] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const res = await apiClient.get(`/api/invoices`, {
                    params: { type: 'PURCHASE' },
                });
                if (!cancelled) setPurchases(res.data || []);
            } catch (err) {
                if (!cancelled) {
                    toastError(err.response?.data?.error || 'Failed to load purchases');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredPurchases = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        if (!search) return purchases;
        return purchases.filter((inv) => {
            const townName = inv.town?.name?.toLowerCase() || '';
            const companyName = inv.company?.name?.toLowerCase() || '';
            const invoiceNo = inv.invoiceNo?.toLowerCase() || '';
            return (
                invoiceNo.includes(search) ||
                townName.includes(search) ||
                companyName.includes(search)
            );
        });
    }, [purchases, searchTerm]);

    const filteredTotal = useMemo(
        () => filteredPurchases.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0),
        [filteredPurchases]
    );

    return (
        <div className="w-full min-w-0">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Purchase Lookup</h1>
                    <p className="text-sm text-gray-500">
                        {filteredPurchases.length} purchase
                        {filteredPurchases.length === 1 ? '' : 's'}
                        {!loading && (
                            <> · Total Rs. {formatNumber(filteredTotal)}</>
                        )}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="search"
                        placeholder="Search invoice #, supplier, or town..."
                        className="border p-2 rounded-input w-full sm:w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Link
                        to="/purchase"
                        className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold text-center hover:bg-emerald-700"
                    >
                        + New Purchase
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white mb-6">
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
                                    <Spinner size="md" label="Loading purchase invoices..." />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            filteredPurchases.map((inv) => (
                                <tr key={inv.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 border">{formatDate(inv.date)}</td>
                                    <td className="p-2 border font-semibold">{inv.invoiceNo}</td>
                                    <td className="p-2 border">{inv.company?.name || '—'}</td>
                                    <td className="p-2 border">{inv.town?.name || '—'}</td>
                                    <td className="p-2 border text-center">
                                        {inv.items?.length ?? '—'}
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
                        {!loading && filteredPurchases.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-4 text-center text-gray-500">
                                    No purchase invoices found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
