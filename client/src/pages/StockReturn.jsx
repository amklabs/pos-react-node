// src/pages/StockReturn.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from "../apiClient.js";

export default function StockReturn() {
    const [invoice, setInvoice] = useState({ invoiceNo: '', date: '', townId: '', customerId: '' });
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState({ productId: '', qty: 1, rate: 0, discount: 0 });

    // Dropdown data
    const [towns, setTowns] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [townRes, custRes, prodRes] = await Promise.all([
                    apiClient.get(`/api/towns`),
                    apiClient.get(`/api/customers`),
                    apiClient.get(`/api/products`)
                ]);
                setTowns(townRes.data);
                setCustomers(custRes.data);
                setProducts(prodRes.data);
            } catch (err) { console.error(err); }
        };
        fetchData().then(()=>{});
    }, []);

    const handleAddItem = () => {
        if (!currentItem.productId) return alert('Please select a product');
        setItems([...items, currentItem]);
        setCurrentItem({ productId: '', qty: 1, rate: 0, discount: 0 });
    };

    const handleSave = async () => {
        if (!invoice.invoiceNo || !invoice.townId || !invoice.customerId) {
            return alert("Invoice No, Town, and Customer are required for a return.");
        }

        try {
            await apiClient.post(`/api/returns`, {
                ...invoice,
                items: items
            });
            alert('Return Processed! Stock added back and Refund recorded.');
            setItems([]);
            setInvoice({ invoiceNo: '', date: '', townId: '', customerId: '' });
        } catch (err) {
            console.error(err);
            alert('Error processing return.');
        }
    };

    const grandTotal = items.reduce((sum, item) => sum + ((item.qty * item.rate) - item.discount), 0);

    return (
        <div className="bg-white p-6 rounded shadow max-w-6xl border-t-4 border-red-500">
            <h1 className="text-2xl font-bold mb-6 text-red-600">Process Stock Return (Refund)</h1>

            {/* Header Inputs */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-semibold mb-1">Return Note #</label>
                    <input type="text" className="border p-2 rounded w-full" onChange={e => setInvoice({...invoice, invoiceNo: e.target.value})} value={invoice.invoiceNo}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Date</label>
                    <input type="date" className="border p-2 rounded w-full" onChange={e => setInvoice({...invoice, date: e.target.value})} value={invoice.date}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Town</label>
                    <select className="border p-2 rounded w-full" onChange={e => setInvoice({...invoice, townId: e.target.value})} value={invoice.townId}>
                        <option value="">Select Town</option>
                        {towns.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Customer</label>
                    <select className="border p-2 rounded w-full" onChange={e => setInvoice({...invoice, customerId: e.target.value})} value={invoice.customerId}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Item Entry Area */}
            <div className="flex gap-2 mb-4 items-end bg-red-50 p-4 rounded border border-red-200">
                <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1">Returned Product</label>
                    <select className="border p-2 rounded w-full" value={currentItem.productId} onChange={e => setCurrentItem({...currentItem, productId: e.target.value})}>
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Qty</label>
                    <input type="number" className="border p-2 rounded w-24" value={currentItem.qty} onChange={e => setCurrentItem({...currentItem, qty: parseInt(e.target.value)})} />
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Refund Rate</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.rate} onChange={e => setCurrentItem({...currentItem, rate: parseFloat(e.target.value)})} />
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Discount %</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.discount} onChange={e => setCurrentItem({...currentItem, discount: parseFloat(e.target.value)})} />
                </div>
                <button onClick={handleAddItem} className="bg-red-600 text-white px-6 py-2 rounded h-10 hover:bg-red-700">Add Item</button>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6 border-collapse text-left">
                <thead>
                <tr className="bg-gray-200">
                    <th className="p-2 border">Product</th>
                    <th className="p-2 border">Qty</th>
                    <th className="p-2 border">Rate</th>
                    <th className="p-2 border">Discount</th>
                    <th className="p-2 border">Refund Amount</th>
                </tr>
                </thead>
                <tbody>
                {items.map((item, idx) => {
                    const productName = products.find(p => p.id === parseInt(item.productId))?.name || item.productId;
                    return (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 border">{productName}</td>
                            <td className="p-2 border">{item.qty}</td>
                            <td className="p-2 border">{item.rate}</td>
                            <td className="p-2 border">{item.discount}</td>
                            <td className="p-2 border font-bold text-red-600">Rs. {(item.qty * item.rate) - item.discount}</td>
                        </tr>
                    )
                })}
                </tbody>
            </table>

            {/* Total and Action Buttons */}
            <div className="flex justify-between items-center border-t pt-4">
                <div className="text-xl font-bold">
                    Total Refund to Customer: <span className="text-red-600">Rs. {grandTotal}</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={handleSave} className="bg-red-600 text-white px-8 py-2 rounded font-bold hover:bg-red-700">Process Return</button>
                    <button onClick={() => { setItems([]); setInvoice({ invoiceNo: '', date: '', townId: '', customerId: '' }); }} className="bg-gray-600 text-white px-8 py-2 rounded font-bold">Cancel</button>
                </div>
            </div>
        </div>
    );
}