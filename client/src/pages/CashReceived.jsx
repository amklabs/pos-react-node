// src/pages/CashReceived.jsx
import {useState, useEffect} from 'react';
import axios from 'axios';

import apiClient from '../apiClient.js';

export default function CashReceived() {
    const [formData, setFormData] = useState({date: '', townId: '', customerId: '', amount: '', note: ''});
    const [customers, setCustomers] = useState([]);
    const [records, setRecords] = useState([]);

    // Fetch customers and existing cash records
    const fetchData = async () => {
        try {
            const [custRes, cashRes] = await Promise.all([
                apiClient.get(`/api/customers`),
                apiClient.get(`/api/cash`)
            ]);
            // console.log(custRes.data);
            // console.log(cashRes.data);
            setCustomers(custRes.data);
            setRecords(cashRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData().then((response) => {
            //
        });
    }, []);

    const handleSave = async () => {
        if (!formData.amount || !formData.customerId) return alert("Customer and Amount are required");
        try {
            await apiClient.post(`/api/cash`, formData);
            alert('Cash Record Saved!');
            setFormData({date: '', townId: '', customerId: '', amount: '', note: ''});
            fetchData().then(() => {
            }); // Refresh the list below
        } catch (err) {
            alert('Error saving');
        }
    };

    return (
        <div className="max-w-5xl">
            <h1 className="text-2xl font-bold mb-6">Cash Received Entry</h1>

            {/* Entry Form */}
            <div className="bg-white p-4 rounded shadow mb-8">
                <div className="flex gap-4 items-end">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Date</label>
                        <input type="date" className="border p-2 rounded" value={formData.date}
                               onChange={e => setFormData({...formData, date: e.target.value})}/>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-semibold mb-1">Customer / Party</label>
                        <select className="border p-2 rounded w-full" value={formData.customerId}
                                onChange={e => setFormData({...formData, customerId: e.target.value})}>
                            <option value="">Select Customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Amount</label>
                        <input type="number" placeholder="Rs." className="border p-2 rounded w-32"
                               value={formData.amount}
                               onChange={e => setFormData({...formData, amount: e.target.value})}/>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-semibold mb-1">Note</label>
                        <input type="text" placeholder="Optional details" className="border p-2 rounded w-full"
                               value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}/>
                    </div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">Save
                        Cash
                    </button>
                </div>
            </div>

            {/* List of Recent Records */}
            <h2 className="text-xl font-bold mb-4">Recent Cash Records</h2>
            <table className="w-full bg-white shadow rounded border-collapse text-left">
                <thead className="bg-gray-200">
                <tr>
                    <th className="p-2 border">Date</th>
                    <th className="p-2 border">Customer / Party</th>
                    <th className="p-2 border">Amount</th>
                    <th className="p-2 border">Note</th>
                </tr>
                </thead>
                <tbody>
                {records.map((rec) => (
                    <tr key={rec.id} className="border-b">
                        <td className="p-2 border">{new Date(rec.date).toLocaleDateString()}</td>
                        <td className="p-2 border">{rec.customer?.name || 'N/A'}</td>
                        <td className="p-2 border font-semibold text-green-600">Rs. {rec.amount}</td>
                        <td className="p-2 border text-gray-600">{rec.note}</td>
                    </tr>
                ))}
                {records.length === 0 && (
                    <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-500">No cash records found.</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}