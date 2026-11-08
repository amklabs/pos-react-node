// src/pages/PurchaseLookup.jsx
import {useState, useEffect} from 'react';
import axios from 'axios';
import {Link} from 'react-router-dom';

import apiClient from "../apiClient.js";
import usePageTitle from "../hooks/usePageTitle.js";
import Spinner from "../components/Spinner.jsx";

export default function PurchaseLookup() {
    usePageTitle('Purchase Lookup');
    const [purchases, setPurchases] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchPurchases = async () => {
            try {
                setLoading(true);
                const res = await apiClient.get(`/api/invoices?type=PURCHASE`);
                // Filter to only show PURCHASES
                const purchaseInvoices = res.data.filter(inv => inv.type === 'PURCHASE');
                setPurchases(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPurchases().then(r => {
            setLoading(false);
        });
    }, []);

    // Filter based on search term
    const filteredPurchases = purchases.filter(inv => {
        const search = searchTerm.toLowerCase();
        const townName = inv.town?.name?.toLowerCase() || '';
        const invoiceNo = inv.invoiceNo?.toLowerCase() || '';
        return invoiceNo.includes(search) || townName.includes(search);
    });

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Purchase Lookup</h1>
                <input
                    type="text"
                    placeholder="Search by Invoice # or Town..."
                    className="border p-2 rounded w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-300 bg-white mb-6">
                <table className="w-full bg-white shadow rounded border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                    <tr>
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Invoice #</th>
                        <th className="p-2 border">Supplier (Company)</th>
                        <th className="p-2 border">Town</th>
                        <th className="p-2 border">Total Amount</th>
                        <th className="p-2 border">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredPurchases.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 border">{new Date(inv.date).toLocaleDateString()}</td>
                            <td className="p-2 border font-semibold">{inv.invoiceNo}</td>
                            <td className="p-2 border">{inv.company?.name || 'N/A'}</td>
                            <td className="p-2 border">{inv.town?.name}</td>
                            <td className="p-2 border font-bold">Rs. {inv.totalAmount}</td>
                            <td className="p-2 border">
                                {/* We will create this view page next */}
                                <Link to={`/invoice/${inv.id}`} className="text-blue-600 hover:underline font-semibold">
                                    View Details
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {loading && (
                        <tr>
                            <td colSpan="6" className="p-4 text-center text-gray-500">
                                <Spinner  size="4" label={'Loading purchase invoices ...'} />
                            </td>
                        </tr>
                    )}
                    {!loading && filteredPurchases.length === 0 && (
                        <tr>
                            <td colSpan="6" className="p-4 text-center text-gray-500">No purchase invoices found.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}