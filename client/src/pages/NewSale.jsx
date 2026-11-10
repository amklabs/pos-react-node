// src/pages/NewSale.jsx
import {useState, useEffect} from 'react';
import apiClient from "../apiClient.js";
import usePageTitle from '../hooks/usePageTitle';
import MySwal from "../components/MySwal.jsx";
import { toastSuccess, toastError } from '../utils/toast';
import {formatNumber} from "../utils/formaters.js";


export default function NewSale() {
    usePageTitle('New Sale');

    const [invoice, setInvoice] = useState({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState({productId: '', qty: 1, rate: 0, discount: 0});
    const [processing, setProcessing] = useState(false);
    // State for editing an existing item in the table
    const [editingIndex, setEditingIndex] = useState(null);
    // State for our dropdown lists
    const [towns, setTowns] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salesmen, setSalesmen] = useState([]);
    const [products, setProducts] = useState([]);

    // Fetch data when page loads
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [townRes, custRes, salesRes, prodRes] = await Promise.all([
                    apiClient.get(`/api/towns`),
                    apiClient.get(`/api/customers`),
                    apiClient.get(`/api/salesmen`),
                    apiClient.get(`/api/products`)
                ]);
                setTowns(townRes.data);
                setCustomers(custRes.data);
                setSalesmen(salesRes.data);
                setProducts(prodRes.data);
            } catch (err) {
                console.error("Error fetching dropdown data", err);
            }
        };
        fetchData().then(() => {
        });
    }, []);

    const handleAddItem = () => {
        if (!currentItem.productId) return alert('Please select a product');
        if (editingIndex !== null) {
            // Update the existing item
            const updated = [...items];
            updated[editingIndex] = currentItem;
            setItems(updated);
            setEditingIndex(null);
        } else {
            setItems([...items, currentItem]);
        }
        setCurrentItem({productId: '', qty: 1, rate: 0, discount: 0});
    };

    const handleEditItem = (idx) => {
        setCurrentItem({...items[idx]});
        setEditingIndex(idx);
    };

    const handleDeleteItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
        if (editingIndex === idx) {
            setEditingIndex(null);
            setCurrentItem({productId: '', qty: 1, rate: 0, discount: 0});
        } else if (editingIndex !== null && idx < editingIndex) {
            setEditingIndex(editingIndex - 1);
            setCurrentItem(null);
        }
    };

    // Compute total for footer
    const grandTotal = items.reduce(
        (sum, item) => sum + (item.qty * item.rate) - item.discount,
        0
    );
    const grandDiscount = items.reduce(
        (sum, item) => sum + item.discount,
        0
    );

    const handleSave = async () => {
        if (!invoice.invoiceNo || !invoice.townId || items.length === 0) {
            toastError("Invoice No, Town Name and at least one item is required.")
            return ;
        }

        try {
            setProcessing(true);
            await apiClient.post(`/api/invoices`, {
                ...invoice,
                type: 'SALE',
                items: items
            });
            setItems([]);
            setInvoice({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
            toastSuccess('Sale Invoice saved successfully!');
        } catch (err) {
            const message =
                err.response?.data?.message || err.message || 'Something went wrong';
            toastError(message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow max-w-6xl">
            <h1 className="text-2xl font-bold mb-6">New Sales Invoice</h1>

            {/* Header Inputs */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-semibold mb-1">Invoice No</label>
                    <input type="text" className="border p-2 rounded w-full" placeholder="Enter Invoice No"
                           onChange={e => setInvoice({...invoice, invoiceNo: e.target.value})}
                           value={invoice.invoiceNo}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Date</label>
                    <input type="date" className="border p-2 rounded w-full"
                           onChange={e => setInvoice({...invoice, date: e.target.value})} value={invoice.date}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Town</label>
                    <select className="border p-2 rounded w-full"
                            onChange={e => setInvoice({...invoice, townId: e.target.value})} value={invoice.townId}>
                        <option value="">Select Town</option>
                        {towns.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Customer</label>
                    <select className="border p-2 rounded w-full"
                            onChange={e => setInvoice({...invoice, customerId: e.target.value})}
                            value={invoice.customerId}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Salesman</label>
                    <select className="border p-2 rounded w-full"
                            onChange={e => setInvoice({...invoice, salesmanId: e.target.value})}
                            value={invoice.salesmanId}>
                        <option value="">Select Salesman</option>
                        {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Item Entry Area */}
            <div className="flex gap-2 mb-4 items-end bg-gray-50 p-4 rounded-lg border ">
                <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1">Product</label>
                    <select className="border p-2 rounded w-full" value={currentItem.productId}
                            onChange={e => setCurrentItem({...currentItem, productId: e.target.value})}>
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Qty</label>
                    <input type="number" className="border p-2 rounded w-24" value={currentItem.qty} step="0.0001"
                           onChange={e => setCurrentItem({...currentItem, qty: parseFloat(e.target.value)})}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Rate</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.rate} step="0.01"
                           onChange={e => setCurrentItem({...currentItem, rate: parseFloat(e.target.value)})}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Discount %</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.discount} step="0.01"
                           onChange={e => setCurrentItem({...currentItem, discount: parseFloat(e.target.value)})}/>
                </div>
                <button onClick={handleAddItem}
                        className="btn btn-primary">{editingIndex !== null ? 'Update Item' : 'Add Item'}
                </button>
                {editingIndex !== null && (
                    <button onClick={() => {
                        setEditingIndex(null);
                        setCurrentItem({productId: '', qty: 1, rate: 0, discount: 0});
                    }} className="btn bg-gray-300">Cancel Edit
                    </button>
                )}
            </div>

            {/* Items Table */}
            <div className="overflow-hidden rounded-lg border border-gray-300 bg-white  mb-6">
                <table className="w-full border-collapse text-left">
                    <thead>
                    <tr className="bg-gray-50 border-b rounded-lg font-semibold">
                        <th className="p-2 font-medium text-gray-700">Product Name</th>
                        <th className="p-2 font-medium text-gray-700 text-end">Qty</th>
                        <th className="p-2 font-medium text-gray-700 text-end">Rate</th>
                        <th className="p-2 font-medium text-gray-700 text-end">Discount</th>
                        <th className="p-2 font-medium text-gray-700 text-end">Sub-Total</th>
                        <th className="p-2 font-medium text-gray-700 w-30 text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((item, idx) => {
                        // Find the product name to display in the table instead of just the ID
                        const productName = products.find(p => p.id === parseInt(item.productId))?.name || item.productId;
                        return (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-2 w-[40%]">{productName}</td>
                                <td className="p-2 w-30 text-end">{item.qty}</td>
                                <td className="p-2 w-30 text-end">{formatNumber(item.rate)}</td>
                                <td className="p-2 w-30 text-end">{formatNumber(item.discount)}</td>
                                <td className="p-2 font-bold w-30 text-end">{formatNumber(((item.qty * item.rate) - item.discount).toFixed(2))}</td>
                                <td className="p-2 w-30 text-center">
                                    <button onClick={() => handleEditItem(idx)}
                                            className="text-blue-600 hover:underline mr-3">Edit</button>
                                    <button onClick={() => handleDeleteItem(idx)}
                                            className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        )
                    })}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan="6" className="p-4 text-center text-gray-500">No items added yet.</td>
                        </tr>
                    )}
                    </tbody>
                    <tfoot>
                    <tr className="bg-gray-100 border-t font-semibold">
                        <td colSpan="3" className="p-2 text-right">Grand Total</td>
                        <td className="p-2 font-bold text-end">{formatNumber(grandDiscount.toFixed(2))}</td>
                        <td className="p-2 font-bold text-end">{formatNumber(grandTotal.toFixed(2))}</td>
                        <td className="p-2 w-30"></td>
                    </tr>
                    </tfoot>
                </table>
            </div>
            {/* Action Buttons */}
            <div className="flex gap-4 border-t border-gray-300 pt-4">
                <button onClick={handleSave} className="btn btn-primary disabled:bg-blue-300" disabled={processing}>Save
                    Invoice
                </button>
                <button onClick={() => {
                    setItems([]);
                    setInvoice({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
                }} className="btn bg-red-300">Cancel
                </button>
            </div>
        </div>
    );
}