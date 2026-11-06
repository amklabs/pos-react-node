// src/pages/SalesReport.jsx
import { useState } from 'react';
import apiClient from "../apiClient.js";

export default function SalesReport() {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [reportData, setReportData] = useState([]);

    const fetchReport = async () => {
        try {
            const res = await apiClient.get(`/api/reports/sales?from=${fromDate}&to=${toDate}`);
            setReportData(res.data);
        } catch (err) { alert('Error fetching report'); }
    };

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">Sales Report</h1>
                <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded">Print Report</button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded shadow mb-6 flex gap-4 items-end print:hidden">
                <div>
                    <label className="block text-sm font-semibold mb-1">From Date</label>
                    <input type="date" className="border p-2 rounded" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">To Date</label>
                    <input type="date" className="border p-2 rounded" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
                <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">Generate</button>
            </div>

            {/* Report Table */}
            <table className="w-full bg-white shadow rounded border-collapse text-left text-sm">
                <thead className="bg-gray-200">
                <tr>
                    <th className="p-2 border">Date</th>
                    <th className="p-2 border">Invoice #</th>
                    <th className="p-2 border">Salesman</th>
                    <th className="p-2 border">Product</th>
                    <th className="p-2 border">Qty</th>
                    <th className="p-2 border">Rate</th>
                    <th className="p-2 border">Total</th>
                </tr>
                </thead>
                <tbody>
                {reportData.map(invoice => (
                    invoice.items.map((item, idx) => (
                        <tr key={`${invoice.id}-${item.id}`} className="border-b">
                            {idx === 0 && (
                                <>
                                    <td className="p-2 border" rowSpan={invoice.items.length}>{new Date(invoice.date).toLocaleDateString()}</td>
                                    <td className="p-2 border font-semibold" rowSpan={invoice.items.length}>{invoice.invoiceNo}</td>
                                    <td className="p-2 border" rowSpan={invoice.items.length}>{invoice.salesman?.name || '-'}</td>
                                </>
                            )}
                            <td className="p-2 border">{item.product.name}</td>
                            <td className="p-2 border">{item.qty}</td>
                            <td className="p-2 border">{item.rate}</td>
                            <td className="p-2 border">{(item.qty * item.rate) - item.discount}</td>
                        </tr>
                    ))
                ))}
                {reportData.length === 0 && (
                    <tr><td colSpan="7" className="p-4 text-center text-gray-500">No sales found for this period.</td></tr>
                )}
                </tbody>
            </table>
        </div>
    );
}