// src/pages/InvoiceLookup.jsx
import {useState, useEffect} from 'react';
import axios from 'axios';
import {Link} from 'react-router-dom';
import apiClient from "../apiClient.js";

export default function InvoiceLookup() {
    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                const res = await apiClient.get(`/api/invoices`);
                setInvoices(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchInvoices().then((response) => {});
    }, []);

    // Filter invoices based on search (Invoice No, Customer Name, or Town)
    const filteredInvoices = invoices.filter(inv => {
        const search = searchTerm.toLowerCase();
        const customerName = inv.customer?.name?.toLowerCase() || '';
        const townName = inv.town?.name?.toLowerCase() || '';
        const invoiceNo = inv.invoiceNo?.toLowerCase() || '';
        return invoiceNo.includes(search) || customerName.includes(search) || townName.includes(search);
    });

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Invoice Lookup (All Invoices)</h1>
                <input
                    type="text"
                    placeholder="Search by Invoice #, Customer, or Town..."
                    className="border p-2 rounded w-80 print:hidden"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <table className="w-full bg-white shadow rounded border-collapse text-left">
                <thead className="bg-gray-200">
                <tr>
                    <th className="p-2 border">Date</th>
                    <th className="p-2 border">Inv #</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Customer / Company</th>
                    <th className="p-2 border">Town</th>
                    <th className="p-2 border">Salesman</th>
                    <th className="p-2 border">Total Amount</th>
                    <th className="p-2 border">Action</th>
                </tr>
                </thead>
                <tbody>
                {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 border">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="p-2 border font-semibold">{inv.invoiceNo}</td>
                        <td className="p-2 border">
                            <span
                                className={`px-2 py-1 rounded text-xs font-bold ${inv.type === 'SALE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {inv.type}
                            </span>
                        </td>
                        <td className="p-2 border">{inv.customer?.name || 'N/A (Purchase)'}</td>
                        <td className="p-2 border">{inv.town?.name}</td>
                        <td className="p-2 border">{inv.salesman?.name || '-'}</td>
                        <td className="p-2 border font-bold">Rs. {inv.totalAmount}</td>
                        <td className="p-2 border">
                            <Link to={`/invoice/${inv.id}`}
                                  className="text-blue-600 hover:underline text-sm font-semibold">View / Print</Link>
                        </td>
                    </tr>
                ))}
                {filteredInvoices.length === 0 && (
                    <tr>
                        <td colSpan="8" className="p-4 text-center text-gray-500">No invoices found.</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
}