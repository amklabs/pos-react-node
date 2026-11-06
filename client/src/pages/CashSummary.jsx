// src/pages/CashSummary.jsx
import {useState, useEffect} from 'react';
import axios from 'axios';
import apiClient from "../apiClient.js";


export default function CashSummary() {
    const [data, setData] = useState({records: [], totalCash: 0});

    const fetchSummary = async () => {
        try {
            const res = await apiClient.get(`/api/reports/cash-summary`);
            setData(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSummary().then(res => {
        });
    }, []);

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">Overall Cash Summary</h1>
                <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded">Print
                    Summary
                </button>
            </div>

            <table className="w-full bg-white shadow rounded border-collapse text-left text-sm mb-6">
                <thead className="bg-gray-200">
                <tr>
                    <th className="p-2 border">Date</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Customer / Party</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Amount</th>
                    <th className="p-2 border">Note</th>
                </tr>
                </thead>
                <tbody>
                {data.records.map((rec) => (
                    <tr key={rec.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 border">{new Date(rec.date).toLocaleDateString()}</td>
                        <td className="p-2 border">
                            <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">
                              {rec.type}
                            </span>
                        </td>
                        <td className="p-2 border">{rec.customer?.name || 'N/A'}</td>
                        <td className="p-2 border">
                          <span
                              className={`px-2 py-1 rounded text-xs font-bold ${rec.type === 'RECEIVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {rec.type}
                          </span>
                        </td>
                        <td className={`p-2 border font-semibold ${rec.type === 'RECEIVED' ? 'text-green-600' : 'text-red-600'}`}>
                            {rec.type === 'RECEIVED' ? '+' : '-'} Rs. {rec.amount}
                        </td>
                        <td className="p-2 border text-gray-500">{rec.note}</td>
                    </tr>
                ))}
                {data.records.length === 0 && (
                    <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">No cash records found.</td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* Total Summary Row */}
            <div className="flex justify-end bg-white p-4 rounded shadow border-t-4 border-blue-600">
                <div className="text-xl font-bold">
                    Total Cash Bank Rs: <span className="text-blue-700">Rs. {data.totalCash.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}