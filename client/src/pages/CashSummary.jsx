// src/pages/CashSummary.jsx
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';

export default function CashSummary() {
    usePageTitle('Cash Summary');
    const [data, setData] = useState({ records: [], totalCash: 0 });
    const [loading, setLoading] = useState(true);

    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/api/reports/cash-summary`);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    return (
        <div className="w-full min-w-0">
            <div className="flex justify-between items-center mb-2 print:hidden">
                <h1 className="text-2xl font-bold">Overall Cash Summary</h1>
                <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={loading}
                    className="bg-gray-800 text-white px-6 py-2 rounded disabled:opacity-60"
                >
                    Print Summary
                </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white mb-2">
                <table className="w-full bg-white shadow rounded border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-2 border">Date</th>
                            <th className="p-2 border">Type</th>
                            <th className="p-2 border">Customer / Party</th>
                            <th className="p-2 border">Amount</th>
                            <th className="p-2 border">Note / Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-gray-500">
                                    <Spinner size="md" label="Loading cash summary..." />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            data.records.map((rec) => (
                                <tr key={rec.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 border">
                                        {new Date(rec.date).toLocaleDateString()}
                                    </td>
                                    <td className="p-2 border">
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                            {rec.type}
                                        </span>
                                    </td>
                                    <td className="p-2 border">
                                        {rec.customer?.name || '-'}
                                    </td>
                                    <td
                                        className={`p-2 border font-semibold ${
                                            rec.type === 'RECEIVED'
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {rec.type === 'RECEIVED' ? '+' : '-'} Rs.{' '}
                                        {rec.amount}
                                    </td>
                                    <td className="p-2 border text-gray-500">{rec.note}</td>
                                </tr>
                            ))}
                        {!loading && data.records.length === 0 && (
                            <tr>
                                <td
                                    colSpan="5"
                                    className="p-4 text-center text-gray-500"
                                >
                                    No cash records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end bg-white p-2 rounded shadow border-t-2 border-blue-600">
                <div className="text-xl font-bold">
                    Total Cash Rs:{' '}
                    <span className="text-blue-700">
                        {loading ? '…' : `Rs. ${data.totalCash.toLocaleString()}`}
                    </span>
                </div>
            </div>
        </div>
    );
}