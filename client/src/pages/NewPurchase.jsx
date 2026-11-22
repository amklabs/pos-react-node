// src/pages/NewPurchase.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import { toastSuccess, toastError } from '../utils/toast';
import { formatNumber, toInputDate } from '../utils/formaters.js';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';

const emptyItem = { productId: '', qty: 1, rate: 0, discount: 0 };
const emptyInvoice = {
    invoiceNo: '',
    date: toInputDate(new Date()),
    townId: '',
    companyId: '',
};

export default function NewPurchase() {
    usePageTitle('New Purchase');
    const confirm = useConfirm();

    const [invoice, setInvoice] = useState(emptyInvoice);
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState(emptyItem);
    const [editingIndex, setEditingIndex] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [savedId, setSavedId] = useState(null);

    const [towns, setTowns] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                setFetching(true);
                const [townRes, compRes, prodRes] = await Promise.all([
                    apiClient.get(`/api/towns`),
                    apiClient.get(`/api/companies`),
                    apiClient.get(`/api/products`),
                ]);
                setTowns(townRes.data);
                setCompanies(compRes.data);
                setProducts(prodRes.data);
            } catch (err) {
                toastError(err.response?.data?.error || 'Failed to load purchase form data');
            } finally {
                setFetching(false);
            }
        })();
    }, []);

    const filteredProducts = useMemo(() => {
        if (!invoice.companyId) return products;
        return products.filter((p) => String(p.companyId) === String(invoice.companyId));
    }, [products, invoice.companyId]);

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

    const handleCompanyChange = (companyId) => {
        setInvoice({ ...invoice, companyId });
        // Clear product selection if it no longer belongs to company
        if (
            currentItem.productId &&
            !products.some(
                (p) =>
                    String(p.id) === String(currentItem.productId) &&
                    String(p.companyId) === String(companyId)
            )
        ) {
            setCurrentItem(emptyItem);
            setEditingIndex(null);
        }
    };

    const handleProductChange = (productId) => {
        const product = products.find((p) => String(p.id) === String(productId));
        const lastRate = product?.lastPRate != null ? Number(product.lastPRate) : 0;
        setCurrentItem({
            ...currentItem,
            productId,
            rate: Number.isFinite(lastRate) ? lastRate : 0,
        });
        // If product implies a company and none selected, set it
        if (product?.companyId && !invoice.companyId) {
            setInvoice((prev) => ({ ...prev, companyId: String(product.companyId) }));
        }
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
            toastError('Enter a valid purchase rate');
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

    const handleDeleteItem = async (idx) => {
        const item = items[idx];
        const name = item
            ? products.find((p) => String(p.id) === String(item.productId))?.name || 'this item'
            : 'this item';
        const ok = await confirm({
            title: 'Remove line item?',
            message: `Remove "${name}" from this purchase?`,
            confirmLabel: 'Remove',
        });
        if (!ok) return;
        setItems(items.filter((_, i) => i !== idx));
        if (editingIndex === idx) {
            setEditingIndex(null);
            setCurrentItem(emptyItem);
        } else if (editingIndex !== null && idx < editingIndex) {
            setEditingIndex(editingIndex - 1);
        }
    };

    const resetForm = () => {
        setInvoice({ ...emptyInvoice, date: toInputDate(new Date()) });
        setItems([]);
        setCurrentItem(emptyItem);
        setEditingIndex(null);
    };

    const handleSave = async () => {
        if (!invoice.invoiceNo || !invoice.townId || !invoice.companyId) {
            toastError('Invoice No, Supplier, and Town are required.');
            return;
        }
        if (items.length === 0) {
            toastError('Add at least one product line.');
            return;
        }

        try {
            setProcessing(true);
            const res = await apiClient.post(`/api/invoices`, {
                invoiceNo: invoice.invoiceNo.trim(),
                date: invoice.date || undefined,
                type: 'PURCHASE',
                townId: invoice.townId,
                companyId: invoice.companyId,
                items,
            });
            toastSuccess('Purchase saved successfully');
            setSavedId(res.data?.id || null);
            resetForm();
        } catch (err) {
            toastError(
                err.response?.data?.error ||
                    err.response?.data?.message ||
                    'Error saving purchase'
            );
        } finally {
            setProcessing(false);
        }
    };

    const productName = (productId) =>
        products.find((p) => p.id === parseInt(productId, 10))?.name || productId;

    return (
        <div className="w-full min-w-0">
            <div className="bg-white p-6 rounded-lg border shadow-lg border-t-4 border-emerald-600">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">New Purchase Invoice</h1>
                        <p className="text-sm text-gray-500">
                            Records stock in and updates each product&apos;s last purchase rate.
                        </p>
                    </div>
                    <Link
                        to="/purchase-lookup"
                        className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                        View purchase history →
                    </Link>
                </div>

                {fetching ? (
                    <div className="py-16">
                        <Spinner size="md" label="Loading form..." />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Vendor Invoice #
                                </label>
                                <input
                                    type="text"
                                    className="border p-2 rounded-input w-full"
                                    placeholder="Supplier invoice number"
                                    value={invoice.invoiceNo}
                                    onChange={(e) =>
                                        setInvoice({ ...invoice, invoiceNo: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Date</label>
                                <DateField
                                    value={invoice.date}
                                    onChange={(date) => setInvoice({ ...invoice, date })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Company / Supplier
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.companyId}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                >
                                    <option value="">Select Supplier</option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Town (warehouse)
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.townId}
                                    onChange={(e) =>
                                        setInvoice({ ...invoice, townId: e.target.value })
                                    }
                                >
                                    <option value="">Select Town</option>
                                    {towns.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4 items-end bg-emerald-50 p-4 rounded border border-emerald-200">
                            <div className="flex-1 min-w-50">
                                <label className="block text-sm font-semibold mb-1">Product</label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={currentItem.productId}
                                    onChange={(e) => handleProductChange(e.target.value)}
                                >
                                    <option value="">
                                        {invoice.companyId
                                            ? 'Select product from supplier'
                                            : 'Select product'}
                                    </option>
                                    {filteredProducts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                            {p.company?.name ? ` (${p.company.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {invoice.companyId && filteredProducts.length === 0 && (
                                    <p className="text-xs text-amber-700 mt-1">
                                        No products linked to this supplier.
                                    </p>
                                )}
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
                                    Purchase rate
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
                                className="btn btn-primary"
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
                                    className="btn btn-secondary text-sm py-1.5 px-3 h-10"
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
                                                className={`border-b hover:bg-gray-50 ${editingIndex === idx ? 'bg-emerald-50' : ''}`}
                                            >
                                                <td className="p-2 border text-gray-500">{idx + 1}</td>
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
                                {items.length > 0 && (
                                    <tfoot className="bg-gray-50 font-semibold">
                                        <tr>
                                            <td className="p-2 border" colSpan="4">
                                                Totals
                                            </td>
                                            <td className="p-2 border text-right">
                                                {formatNumber(totals.discount)}
                                            </td>
                                            <td className="p-2 border text-right text-emerald-700 text-base">
                                                Rs. {formatNumber(totals.total)}
                                            </td>
                                            <td className="p-2 border print:hidden"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-t pt-4">
                            <div className="text-lg font-bold">
                                Grand Total:{' '}
                                <span className="text-emerald-700">
                                    Rs. {formatNumber(totals.total)}
                                </span>
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                    ({items.length} line{items.length === 1 ? '' : 's'})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 print:hidden">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={processing}
                                    className="btn btn-primary"
                                >
                                    {processing ? 'Saving…' : 'Save Purchase'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    disabled={processing}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {savedId && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center justify-between print:hidden">
                    <p className="text-sm text-emerald-900">
                        Purchase saved. You can open it for print or review.
                    </p>
                    <Link
                        to={`/invoice/${savedId}`}
                        className="text-sm font-semibold text-emerald-800 hover:underline"
                    >
                        View / Print →
                    </Link>
                </div>
            )}
        </div>
    );
}
