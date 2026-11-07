// src/pages/NewSale.jsx
import {useState, useEffect} from 'react';
import apiClient from "../apiClient.js";

export default function NewSale() {
    const [invoice, setInvoice] = useState({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState({productId: '', qty: 1, rate: 0, discount: 0});

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
        setItems([...items, currentItem]);
        setCurrentItem({productId: '', qty: 1, rate: 0, discount: 0});
    };

    const handleSave = async () => {
        if (!invoice.invoiceNo || !invoice.townId) return alert("Invoice No and Town are required");

        try {
            await apiClient.post(`/api/invoices`, {
                ...invoice,
                type: 'SALE',
                items: items
            });
            alert('Sale Saved Successfully!');
            setItems([]);
            setInvoice({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
        } catch (err) {
            console.error(err);
            alert('Error saving sale. Check console.');
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow max-w-6xl">
            <h1 className="text-2xl font-bold mb-6">New Sales Invoice</h1>

            {/* Header Inputs */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-semibold mb-1">Invoice No</label>
                    <input type="text" className="border p-2 rounded w-full"
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
            <div className="flex gap-2 mb-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-300">
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
                    <input type="number" className="border p-2 rounded w-24" value={currentItem.qty}
                           onChange={e => setCurrentItem({...currentItem, qty: parseInt(e.target.value)})}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Rate</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.rate}
                           onChange={e => setCurrentItem({...currentItem, rate: parseFloat(e.target.value)})}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Discount %</label>
                    <input type="number" className="border p-2 rounded w-32" value={currentItem.discount}
                           onChange={e => setCurrentItem({...currentItem, discount: parseFloat(e.target.value)})}/>
                </div>
                <button onClick={handleAddItem}
                        className="bg-blue-600 text-white px-6 py-2 rounded h-10 hover:bg-blue-700">Add Item
                </button>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6  border border-gray-300 border-collapse text-left">
                <thead className="rounded-lg">
                <tr className="bg-gray-200 rounded-lg">
                    <th className="p-2">Product</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Rate</th>
                    <th className="p-2">Discount</th>
                    <th className="p-2">Total</th>
                </tr>
                </thead>
                <tbody>
                {items.map((item, idx) => {
                    // Find the product name to display in the table instead of just the ID
                    const productName = products.find(p => p.id === parseInt(item.productId))?.name || item.productId;
                    return (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 border">{productName}</td>
                            <td className="p-2 border">{item.qty}</td>
                            <td className="p-2 border">{item.rate}</td>
                            <td className="p-2 border">{item.discount}</td>
                            <td className="p-2 border font-bold">{(item.qty * item.rate) - item.discount}</td>
                        </tr>
                    )
                })}
                {items.length === 0 && (
                    <tr>
                        <td colSpan="5" className="p-4 text-center text-gray-500">No items added yet.</td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* Action Buttons */}
            <div className="flex gap-4 border-t border-gray-300 pt-4">
                <button onClick={handleSave} className="btn btn-primary">Save Invoice</button>
                <button onClick={() => window.print()} className="btn bg-green-300">Print</button>
                <button onClick={() => {
                    setItems([]);
                    setInvoice({invoiceNo: '', date: '', townId: '', customerId: '', salesmanId: ''});
                }} className="btn btn-secondary">Cancel
                </button>
            </div>
        </div>
    );
}