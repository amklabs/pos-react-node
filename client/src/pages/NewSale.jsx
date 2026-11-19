// src/pages/NewSale.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import { toastSuccess, toastError } from '../utils/toast';
import { formatNumber, toInputDate } from '../utils/formaters.js';

const emptyItem = { productId: '', qty: 1, rate: 0, discount: 0 };

function makeEmptyInvoice() {
    return {
        invoiceNo: '',
        date: toInputDate(new Date()),
        townId: '',
        customerId: '',
        salesmanId: '',
        totalPayment: 0,
    };
}

function suggestInvoiceNo() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `SAL-${y}${m}${d}-${h}${min}${s}`;
}

export default function NewSale() {
    usePageTitle('New Sale');

    const [invoice, setInvoice] = useState(makeEmptyInvoice);
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState(emptyItem);
    const [editingIndex, setEditingIndex] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [savedId, setSavedId] = useState(null);

    const [towns, setTowns] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salesmen, setSalesmen] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                setFetching(true);
                const [townRes, custRes, salesRes, prodRes] = await Promise.all([
                    apiClient.get(`/api/towns`),
                    apiClient.get(`/api/customers`),
                    apiClient.get(`/api/salesmen`),
                    apiClient.get(`/api/products`),
                ]);
                setTowns(townRes.data);
                setCustomers(custRes.data);
                setSalesmen(salesRes.data);
                setProducts(prodRes.data);
            } catch (err) {
                toastError(err.response?.data?.error || 'Failed to load sale form data');
            } finally {
                setFetching(false);
            }
        })();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!invoice.townId) return customers;
        return customers.filter((c) => String(c.townId) === String(invoice.townId));
    }, [customers, invoice.townId]);

    const totals = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                const sub = Number(item.qty || 0) * Number(item.rate || 0);
                const disc = Number(item.discount || 0);
                acc.subTotal += sub;
                acc.discount += disc;
                acc.total += sub - disc;
                return acc;
            },
            { subTotal: 0, discount: 0, total: 0 }
        );
    }, [items]);

    const balance = totals.total - Number(invoice.totalPayment || 0);

    const handleTownChange = (townId) => {
        const customerStillValid = customers.some(
            (c) =>
                String(c.id) === String(invoice.customerId) &&
                String(c.townId) === String(townId)
        );
        setInvoice({
            ...invoice,
            townId,
            customerId: customerStillValid ? invoice.customerId : '',
        });
    };

    const handleProductChange = (productId) => {
        const product = products.find((p) => String(p.id) === String(productId));
        const lastRate = product?.lastSRate != null ? Number(product.lastSRate) : 0;
        setCurrentItem({
            ...currentItem,
            productId,
            rate: Number.isFinite(lastRate) ? lastRate : 0,
        });
    };

    const handleAddItem = () => {
        if (!currentItem.productId) {
            toastError('Please select a product');
            return;
        }
        if (!(Number(currentItem.qty) > 0)) {
            toastError('Quantity must be greater than 0');
            return;
        }
        if (!(Number(currentItem.rate) >= 0)) {
            toastError('Enter a valid unit rate');
            return;
        }
        const disc = Number(currentItem.discount) || 0;
        const sub = Number(currentItem.qty) * Number(currentItem.rate);
        if (disc > sub) {
            toastError('Discount cannot exceed line subtotal');
            return;
        }

        const line = {
            productId: currentItem.productId,
            qty: Number(currentItem.qty),
            rate: Number(currentItem.rate),
            discount: disc,
        };

        if (editingIndex !== null) {
            const updated = [...items];
            updated[editingIndex] = line;
            setItems(updated);
            setEditingIndex(null);
        } else {
            setItems([...items, line]);
        }
        setCurrentItem(emptyItem);
    };

    const handleEditItem = (idx) => {
        setCurrentItem({ ...items[idx] });
        setEditingIndex(idx);
    };

    const handleDeleteItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
        if (editingIndex === idx) {
            setEditingIndex(null);
            setCurrentItem(emptyItem);
        } else if (editingIndex !== null && idx < editingIndex) {
            setEditingIndex(editingIndex - 1);
        }
    };

    const resetForm = () => {
        setInvoice(makeEmptyInvoice());
        setItems([]);
        setCurrentItem(emptyItem);
        setEditingIndex(null);
    };

    const handleSave = async () => {
        if (!invoice.invoiceNo?.trim() || !invoice.townId || items.length === 0) {
            toastError('Invoice No, Town and at least one item are required.');
            return;
        }
        if (!invoice.customerId) {
            toastError('Select a customer for this sale.');
            return;
        }
        if (Number(invoice.totalPayment) > totals.total + 0.001) {
            toastError('Paid amount cannot exceed invoice total.');
            return;
        }

        try {
            setProcessing(true);
            const res = await apiClient.post(`/api/invoices`, {
                invoiceNo: invoice.invoiceNo.trim(),
                date: invoice.date || undefined,
                type: 'SALE',
                townId: invoice.townId,
                customerId: invoice.customerId,
                salesmanId: invoice.salesmanId || null,
                items,
                amountReceived: Number(invoice.totalPayment) || 0,
            });
            toastSuccess('Sale invoice saved successfully');
            setSavedId(res.data?.id || null);
            resetForm();
        } catch (err) {
            toastError(
                err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message ||
                    'Something went wrong'
            );
        } finally {
            setProcessing(false);
        }
    };

    const productName = (productId) =>
        products.find((p) => p.id === parseInt(productId, 10))?.name || productId;

    return (
        <div className="w-full min-w-0">
            <div className="bg-white p-6 rounded-lg border shadow-lg border-t-4 border-blue-600">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">New Sales Invoice</h1>
                        <p className="text-sm text-gray-500">
                            Creates a sale, reduces stock, and optionally records cash received.
                        </p>
                    </div>
                    <Link
                        to="/invoice-lookup"
                        className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                        Invoice lookup →
                    </Link>
                </div>

                {fetching ? (
                    <div className="py-16">
                        <Spinner size="md" label="Loading form..." />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-semibold mb-1">
                                    Invoice No
                                </label>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        className="border p-2 rounded-input w-full"
                                        placeholder="Invoice number"
                                        value={invoice.invoiceNo}
                                        onChange={(e) =>
                                            setInvoice({ ...invoice, invoiceNo: e.target.value })
                                        }
                                    />
                                    <button
                                        type="button"
                                        title="Generate invoice number"
                                        className="border px-2 rounded-input text-xs font-semibold text-blue-700 hover:bg-blue-50 shrink-0"
                                        onClick={() =>
                                            setInvoice({
                                                ...invoice,
                                                invoiceNo: suggestInvoiceNo(),
                                            })
                                        }
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Date</label>
                                <DateField
                                    value={invoice.date}
                                    onChange={(date) => setInvoice({ ...invoice, date })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Town</label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.townId}
                                    onChange={(e) => handleTownChange(e.target.value)}
                                >
                                    <option value="">Select Town</option>
                                    {towns.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Customer
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.customerId}
                                    onChange={(e) =>
                                        setInvoice({ ...invoice, customerId: e.target.value })
                                    }
                                >
                                    <option value="">Select Customer</option>
                                    {filteredCustomers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                            {c.phone ? ` (${c.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {invoice.townId && filteredCustomers.length === 0 && (
                                    <p className="text-xs text-amber-700 mt-1">
                                        No customers in this town.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Salesman
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.salesmanId}
                                    onChange={(e) =>
                                        setInvoice({ ...invoice, salesmanId: e.target.value })
                                    }
                                >
                                    <option value="">Optional</option>
                                    {salesmen.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4 items-end bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-semibold mb-1">
                                    Product
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={currentItem.productId}
                                    onChange={(e) => handleProductChange(e.target.value)}
                                >
                                    <option value="">Select Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                            {p.company?.name ? ` · ${p.company.name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Qty</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="border p-2 rounded-input w-24"
                                    value={currentItem.qty}
                                    onChange={(e) =>
                                        setCurrentItem({
                                            ...currentItem,
                                            qty:
                                                e.target.value === ''
                                                    ? ''
                                                    : parseFloat(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Unit rate
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="border p-2 rounded-input w-32"
                                    value={currentItem.rate}
                                    onChange={(e) =>
                                        setCurrentItem({
                                            ...currentItem,
                                            rate:
                                                e.target.value === ''
                                                    ? ''
                                                    : parseFloat(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Discount (Rs)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="border p-2 rounded-input w-28"
                                    value={currentItem.discount}
                                    onChange={(e) =>
                                        setCurrentItem({
                                            ...currentItem,
                                            discount:
                                                e.target.value === ''
                                                    ? ''
                                                    : parseFloat(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="bg-blue-600 text-white px-6 py-2 rounded h-10 font-semibold hover:bg-blue-700"
                            >
                                {editingIndex !== null ? 'Update Item' : 'Add Item'}
                            </button>
                            {editingIndex !== null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingIndex(null);
                                        setCurrentItem(emptyItem);
                                    }}
                                    className="text-sm text-gray-600 hover:underline h-10"
                                >
                                    Cancel edit
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white mb-6">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="p-2 border">#</th>
                                        <th className="p-2 border">Product</th>
                                        <th className="p-2 border text-right">Qty</th>
                                        <th className="p-2 border text-right">Rate</th>
                                        <th className="p-2 border text-right">Discount</th>
                                        <th className="p-2 border text-right">Total</th>
                                        <th className="p-2 border print:hidden">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const lineTotal =
                                            Number(item.qty) * Number(item.rate) -
                                            (Number(item.discount) || 0);
                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b hover:bg-gray-50 ${editingIndex === idx ? 'bg-blue-50' : ''}`}
                                            >
                                                <td className="p-2 border text-gray-500">
                                                    {idx + 1}
                                                </td>
                                                <td className="p-2 border font-medium">
                                                    {productName(item.productId)}
                                                </td>
                                                <td className="p-2 border text-right">
                                                    {formatNumber(item.qty)}
                                                </td>
                                                <td className="p-2 border text-right">
                                                    {formatNumber(item.rate)}
                                                </td>
                                                <td className="p-2 border text-right">
                                                    {formatNumber(item.discount || 0)}
                                                </td>
                                                <td className="p-2 border text-right font-bold">
                                                    {formatNumber(lineTotal)}
                                                </td>
                                                <td className="p-2 border print:hidden space-x-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditItem(idx)}
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteItem(idx)}
                                                        className="text-red-600 hover:underline"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {items.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="p-4 text-center text-gray-500"
                                            >
                                                No items added yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between max-w-sm">
                                    <span className="text-gray-600">Sub total</span>
                                    <span className="font-semibold">
                                        Rs. {formatNumber(totals.subTotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between max-w-sm">
                                    <span className="text-gray-600">Total discount</span>
                                    <span className="font-semibold">
                                        Rs. {formatNumber(totals.discount)}
                                    </span>
                                </div>
                                <div className="flex justify-between max-w-sm text-base">
                                    <span className="font-bold">Grand total</span>
                                    <span className="font-bold text-blue-700">
                                        Rs. {formatNumber(totals.total)}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gray-50 border rounded-lg p-4 max-w-md md:ml-auto w-full">
                                <label className="block text-sm font-semibold mb-1">
                                    Amount received (optional)
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        className="border p-2 rounded-input w-full text-right"
                                        value={invoice.totalPayment}
                                        onChange={(e) =>
                                            setInvoice({
                                                ...invoice,
                                                totalPayment:
                                                    e.target.value === ''
                                                        ? ''
                                                        : parseFloat(e.target.value),
                                            })
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="border px-3 rounded-input text-xs font-semibold text-blue-700 hover:bg-blue-50 shrink-0"
                                        onClick={() =>
                                            setInvoice({
                                                ...invoice,
                                                totalPayment: Number(totals.total.toFixed(2)),
                                            })
                                        }
                                        disabled={totals.total <= 0}
                                    >
                                        Full
                                    </button>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Balance due</span>
                                    <span
                                        className={`font-bold ${balance > 0.001 ? 'text-red-600' : 'text-green-600'}`}
                                    >
                                        Rs. {formatNumber(balance)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Partial or full payment updates invoice payment status.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t mt-6 pt-4 print:hidden">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={processing}
                                className="bg-blue-600 text-white px-8 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-60"
                            >
                                {processing ? 'Saving…' : 'Save Invoice'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={processing}
                                className="bg-gray-600 text-white px-6 py-2 rounded font-bold"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>

            {savedId && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-4 flex items-center justify-between print:hidden">
                    <p className="text-sm text-blue-900">
                        Sale saved. Open it to print or review payment status.
                    </p>
                    <Link
                        to={`/invoice/${savedId}`}
                        className="text-sm font-semibold text-blue-800 hover:underline"
                    >
                        View / Print →
                    </Link>
                </div>
            )}
        </div>
    );
}
