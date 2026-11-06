// src/pages/CustomerLedger.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from "../apiClient.js";

export default function CustomerLedger() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        apiClient.get(`/api/customers`).then(res => setCustomers(res.data));
    }, []);

    const handleFetchLedger = async () => {
        if (!selectedCustomer) return;
        try {
            const res = await apiClient.get(`/api/customers/${selectedCustomer}/ledger`);
            setData(res.data);
        } catch (err) { alert("Error fetching ledger"); }
    };

    return (
        <div className="max-w-5xl">
            <h1 className="text-2xl font-bold mb-6">Customer Ledger</h1>

            <div className="bg-white p-4 rounded shadow mb-6 flex gap-4 items-end print:hidden">
                <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1">Select Customer</label>
                    <select className="border p-2 rounded w-full" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                        <option value="">Choose a customer...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                    </select>
                </div>
                <button onClick={handleFetchLedger} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">View Ledger</button>
            </div>

            {data && (
                <div className="bg-white p-8 rounded shadow print:shadow-none print:p-0">
                    <div className="flex justify-between items-start mb-8 border-b pb-4">
                        <div>
                            <h2 className="text-2xl font-bold">{data.customer.name}</h2>
                            <p className="text-gray-600">{data.customer.phone}</p>
                            <p className="text-gray-600">Town: {data.customer.town?.name}</p>
                        </div>
                        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded print:hidden">Print Statement</button>
                    </div>

                    <table className="w-full mb-8 border-collapse text-left text-sm">
                        <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border">Date</th>
                            <th className="p-2 border">Reference / Note</th>
                            <th className="p-2 border">Type</th>
                            <th className="p-2 border text-right">Debit (Sale)</th>
                            <th className="p-2 border text-right">Credit (Cash)</th>
                            <th className="p-2 border text-right">Balance</th>
                        </tr>
                        </thead>
                        <tbody>
                        {data.ledger.map((row, idx) => (
                            <tr key={idx} className="border-b">
                                <td className="p-2 border">{new Date(row.date).toLocaleDateString()}</td>
                                <td className="p-2 border">{row.ref}</td>
                                <td className="p-2 border">{row.type}</td>
                                <td className="p-2 border text-right">{row.type.includes('SALE') ? `Rs. ${row.amount}` : '-'}</td>
                                <td className="p-2 border text-right text-green-600">{row.type.includes('CASH') ? `Rs. ${row.amount}` : '-'}</td>
                                <td className={`p-2 border text-right font-bold ${row.runningBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    Rs. {row.runningBalance}
                                </td>
                            </tr>
                        ))}
                        {data.ledger.length === 0 && (
                            <tr><td colSpan="6" className="p-4 text-center text-gray-500">No transactions found.</td></tr>
                        )}
                        </tbody>
                    </table>

                    <div className="flex justify-end gap-12 border-t-2 pt-4">
                        <div className="text-right">
                            <p className="text-gray-500 text-sm">Total Debit:</p>
                            <p className="font-bold text-lg text-red-600">Rs. {data.totalDebit}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 text-sm">Total Credit:</p>
                            <p className="font-bold text-lg text-green-600">Rs. {data.totalCredit}</p>
                        </div>
                        <div className="text-right bg-gray-100 p-2 rounded">
                            <p className="text-gray-800 text-sm font-bold">Outstanding Balance:</p>
                            <p className={`font-bold text-xl ${data.finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                Rs. {data.finalBalance}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}