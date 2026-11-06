// src/pages/StockReport.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from "../apiClient.js";

export default function StockReport() {
    const [stockData, setStockData] = useState([]);

    useEffect(() => {
        const fetchStock = async () => {
            try {
                const res = await apiClient.get(`/api/reports/stock`);
                setStockData(res.data);
            } catch (err) { console.error(err); }
        };
        fetchStock().then(()=>{});
    }, []);

    // Calculate Totals for the summary boxes
    const totalProducts = stockData.length;
    const totalQty = stockData.reduce((sum, item) => sum + item.balanceQty, 0);

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">Stock Report</h1>
                <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded">Print Report</button>
            </div>

            {/* Summary Boxes */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
                    <p className="text-gray-500 text-sm font-semibold">Total Products</p>
                    <p className="text-3xl font-bold">{totalProducts}</p>
                </div>
                <div className="bg-white p-6 rounded shadow border-l-4 border-green-500">
                    <p className="text-gray-500 text-sm font-semibold">Total Balance Qty</p>
                    <p className="text-3xl font-bold">{totalQty}</p>
                </div>
                <div className="bg-white p-6 rounded shadow border-l-4 border-purple-500">
                    <p className="text-gray-500 text-sm font-semibold">Stock Value</p>
                    <p className="text-xl font-bold text-gray-400">(Requires Cost Price)</p>
                </div>
            </div>

            {/* Detailed Table */}
            <table className="w-full bg-white shadow rounded border-collapse text-left text-sm">
                <thead className="bg-gray-200">
                <tr>
                    <th className="p-2 border">Product Name</th>
                    <th className="p-2 border">Purchased Qty</th>
                    <th className="p-2 border">Sold Qty</th>
                    <th className="p-2 border">Return Qty</th>
                    <th className="p-2 border bg-gray-300">Balance Qty</th>
                </tr>
                </thead>
                <tbody>
                {stockData.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 border font-semibold">{item.name}</td>
                        <td className="p-2 border text-blue-600">{item.purchasedQty}</td>
                        <td className="p-2 border text-orange-600">{item.soldQty}</td>
                        <td className="p-2 border text-red-600">{item.returnQty}</td>
                        <td className={`p-2 border font-bold ${item.balanceQty < 5 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.balanceQty}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}