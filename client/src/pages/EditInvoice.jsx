// src/pages/EditInvoice.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import { toastSuccess, toastError } from '../utils/toast';
import { formatNumber, toInputDate } from '../utils/formaters.js';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { useAuthContext } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';

const emptyItem = { productId: '', qty: 1, rate: 0, discount: 0 };

function isInvoiceCashNote(note, invoiceNo) {
    const n = String(note || '');
    return (
        n === `Payment for Invoice #${invoiceNo}` ||
        n.startsWith('Payment for Invoice #')
    );
}

export default function EditInvoice() {
    usePageTitle('Edit Invoice');
    const { id } = useParams();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { user } = useAuthContext();
    const admin = isAdmin(user);

    const [invoiceType, setInvoiceType] = useState(null);
    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState(emptyItem);
    const [editingIndex, setEditingIndex] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [otherPaid, setOtherPaid] = useState(0);

    const [towns, setTowns] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salesmen, setSalesmen] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setFetching(true);
                const invRes = await apiClient.get(`/api/invoices/${id}`);
                const inv = invRes.data;
                if (cancelled) return;

                if (!['SALE', 'PURCHASE'].includes(inv.type)) {
                    toastError('Only sale and purchase invoices can be edited');
                    navigate(`/invoice/${id}`, { replace: true });
                    return;
                }
                if (inv.type === 'PURCHASE' && !admin) {
                    toastError('Insufficient permissions to edit purchases');
                    navigate(`/invoice/${id}`, { replace: true });
                    return;
                }

                const masterCalls =
                    inv.type === 'SALE'
                        ? Promise.all([
                              apiClient.get('/api/towns'),
                              apiClient.get('/api/customers'),
                              apiClient.get('/api/salesmen'),
                              apiClient.get('/api/products'),
                          ])
                        : Promise.all([
                              apiClient.get('/api/towns'),
                              apiClient.get('/api/companies'),
                              apiClient.get('/api/products'),
                          ]);

                const master = await masterCalls;
                if (cancelled) return;

                if (inv.type === 'SALE') {
                    setTowns(master[0].data);
                    setCustomers(master[1].data);
                    setSalesmen(master[2].data);
                    setProducts(master[3].data);

                    const payments = (inv.payments || []).filter(
                        (p) => p.type === 'RECEIVED'
                    );
                    let primary =
                        payments.find((p) =>
                            isInvoiceCashNote(p.note, inv.invoiceNo)
                        ) || null;
                    if (!primary && payments.length === 1) {
                        primary = payments[0];
                    }
                    const invoicePaid = primary ? Number(primary.amount || 0) : 0;
                    const other = payments
                        .filter((p) => !primary || p.id !== primary.id)
                        .reduce((s, p) => s + Number(p.amount || 0), 0);

                    setOtherPaid(other);
                    setInvoice({
                        invoiceNo: inv.invoiceNo || '',
                        date: toInputDate(inv.date),
                        townId: inv.townId ? String(inv.townId) : '',
                        customerId: inv.customerId ? String(inv.customerId) : '',
                        salesmanId: inv.salesmanId ? String(inv.salesmanId) : '',
                        totalPayment: invoicePaid,
                    });
                } else {
                    setTowns(master[0].data);
                    setCompanies(master[1].data);
                    setProducts(master[2].data);
                    setOtherPaid(0);
                    setInvoice({
                        invoiceNo: inv.invoiceNo || '',
                        date: toInputDate(inv.date),
                        townId: inv.townId ? String(inv.townId) : '',
                        companyId: inv.companyId ? String(inv.companyId) : '',
                    });
                }

                setInvoiceType(inv.type);
                setItems(
                    (inv.items || []).map((line) => ({
                        productId: String(line.productId),
                        qty: Number(line.qty),
                        rate: Number(line.rate),
                        discount: Number(line.discount || 0),
                        costRate:
                            line.costRate != null ? Number(line.costRate) : undefined,
                    }))
                );
            } catch (err) {
                toastError(err.response?.data?.error || 'Failed to load invoice');
                if (!cancelled) navigate(-1);
            } finally {
                if (!cancelled) setFetching(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, navigate, admin]);

    const isSale = invoiceType === 'SALE';

    const filteredCustomers = useMemo(() => {
        if (!invoice?.townId) return customers;
        return customers.filter((c) => String(c.townId) === String(invoice.townId));
    }, [customers, invoice?.townId]);

    const filteredProducts = useMemo(() => {
        if (isSale || !invoice?.companyId) return products;
        return products.filter((p) => String(p.companyId) === String(invoice.companyId));
    }, [products, invoice?.companyId, isSale]);

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

    const invoicePaid = Number(invoice?.totalPayment || 0);
    const balance = totals.total - invoicePaid - otherPaid;

    const handleTownChange = (townId) => {
        if (!isSale) {
            setInvoice({ ...invoice, townId });
            return;
        }
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

    const handleCompanyChange = (companyId) => {
        setInvoice({ ...invoice, companyId });
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
        const lastRate = isSale
            ? product?.lastSRate != null
                ? Number(product.lastSRate)
                : 0
            : product?.lastPRate != null
              ? Number(product.lastPRate)
              : 0;
        setCurrentItem({
            ...currentItem,
            productId,
            rate: Number.isFinite(lastRate) ? lastRate : 0,
        });
        if (!isSale && product?.companyId && !invoice.companyId) {
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
            costRate: currentItem.costRate,
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
            ? products.find((p) => String(p.id) === String(item.productId))?.name ||
              'this item'
            : 'this item';
        const ok = await confirm({
            title: 'Remove line item?',
            message: `Remove "${name}" from this invoice?`,
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

    const handleSave = async () => {
        if (!invoice?.invoiceNo?.trim() || !invoice.townId || items.length === 0) {
            toastError('Invoice No, Town and at least one item are required.');
            return;
        }
        if (isSale && !invoice.customerId) {
            toastError('Select a customer for this sale.');
            return;
        }
        if (!isSale && !invoice.companyId) {
            toastError('Select a supplier for this purchase.');
            return;
        }
        if (isSale && invoicePaid + otherPaid > totals.total + 0.001) {
            toastError('Total payments cannot exceed invoice total.');
            return;
        }

        const ok = await confirm({
            title: 'Save changes?',
            message: isSale
                ? 'Update this sale invoice and sync the associated cash payment if needed?'
                : 'Update this purchase invoice?',
            confirmLabel: 'Save',
        });
        if (!ok) return;

        try {
            setProcessing(true);
            const payload = {
                invoiceNo: invoice.invoiceNo.trim(),
                date: invoice.date || undefined,
                townId: invoice.townId,
                items: items.map(({ productId, qty, rate, discount, costRate }) => ({
                    productId,
                    qty,
                    rate,
                    discount,
                    ...(costRate != null ? { costRate } : {}),
                })),
            };
            if (isSale) {
                payload.customerId = invoice.customerId;
                payload.salesmanId = invoice.salesmanId || null;
                payload.amountReceived = invoicePaid;
            } else {
                payload.companyId = invoice.companyId;
            }

            await apiClient.put(`/api/invoices/${id}`, payload);
            toastSuccess('Invoice updated successfully');
            navigate(`/invoice/${id}`);
        } catch (err) {
            toastError(
                err.response?.data?.error ||
                    err.response?.data?.message ||
                    err.message ||
                    'Failed to update invoice'
            );
        } finally {
            setProcessing(false);
        }
    };

    const productName = (productId) =>
        products.find((p) => p.id === parseInt(productId, 10))?.name || productId;

    if (fetching || !invoice) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Spinner label="Loading invoice..." />
            </div>
        );
    }

    return (
        <div className="w-full min-w-0">
            <div
                className={`bg-white p-6 rounded-lg border shadow-lg border-t-4 ${
                    isSale ? 'border-blue-600' : 'border-emerald-600'
                }`}
            >
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Edit {isSale ? 'Sales' : 'Purchase'} Invoice
                        </h1>
                        <p className="text-sm text-gray-500">
                            {isSale
                                ? 'Updates lines, stock, and the on-invoice cash payment. Later Cash Received entries stay as-is.'
                                : 'Updates purchase lines and stock. Cannot reduce qty below remaining stock.'}
                        </p>
                    </div>
                    <Link
                        to={`/invoice/${id}`}
                        className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                        View invoice →
                    </Link>
                </div>

                <div
                    className={`grid grid-cols-1 ${
                        isSale ? 'md:grid-cols-5' : 'md:grid-cols-4'
                    } gap-4 mb-6`}
                >
                    <div className={isSale ? 'md:col-span-1' : ''}>
                        <label className="block text-sm font-semibold mb-1">
                            {isSale ? 'Invoice No' : 'Vendor Invoice #'}
                        </label>
                        <input
                            type="text"
                            className="border p-2 rounded-input w-full"
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
                    {isSale ? (
                        <>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Town
                                </label>
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
                                        setInvoice({
                                            ...invoice,
                                            customerId: e.target.value,
                                        })
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
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Salesman
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={invoice.salesmanId}
                                    onChange={(e) =>
                                        setInvoice({
                                            ...invoice,
                                            salesmanId: e.target.value,
                                        })
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
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>

                <div
                    className={`flex flex-wrap gap-2 mb-4 items-end p-4 rounded-lg border ${
                        isSale
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-emerald-50 border-emerald-200'
                    }`}
                >
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold mb-1">Product</label>
                        <select
                            className="border p-2 rounded-input w-full"
                            value={currentItem.productId}
                            onChange={(e) => handleProductChange(e.target.value)}
                        >
                            <option value="">Select Product</option>
                            {filteredProducts.map((p) => (
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
                            {isSale ? 'Unit rate' : 'Purchase rate'}
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
                        className={`${
                            isSale
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                        } text-white px-6 py-2 rounded h-10 font-semibold`}
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
                                <th className="p-2 border">Action</th>
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
                                        className={`border-b hover:bg-gray-50 ${
                                            editingIndex === idx
                                                ? isSale
                                                    ? 'bg-blue-50'
                                                    : 'bg-emerald-50'
                                                : ''
                                        }`}
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
                                        <td className="p-2 border space-x-3">
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
                            <span
                                className={`font-bold ${
                                    isSale ? 'text-blue-700' : 'text-emerald-700'
                                }`}
                            >
                                Rs. {formatNumber(totals.total)}
                            </span>
                        </div>
                    </div>

                    {isSale && (
                        <div className="bg-gray-50 border rounded-lg p-4 max-w-md md:ml-auto w-full">
                            <label className="block text-sm font-semibold mb-1">
                                Amount received (on invoice)
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
                                            totalPayment: Number(
                                                Math.max(
                                                    0,
                                                    totals.total - otherPaid
                                                ).toFixed(2)
                                            ),
                                        })
                                    }
                                    disabled={totals.total <= 0}
                                >
                                    Full
                                </button>
                            </div>
                            {otherPaid > 0.001 && (
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">
                                        Other cash received
                                    </span>
                                    <span className="font-semibold">
                                        Rs. {formatNumber(otherPaid)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Balance due</span>
                                <span
                                    className={`font-bold ${
                                        balance > 0.001
                                            ? 'text-red-600'
                                            : 'text-green-600'
                                    }`}
                                >
                                    Rs. {formatNumber(balance)}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Edits update the linked cash payment note for this
                                invoice. Payments recorded later via Cash Received are
                                unchanged.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t mt-6 pt-4">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={processing}
                        className={`${
                            isSale
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                        } text-white px-8 py-2 rounded font-bold disabled:opacity-60`}
                    >
                        {processing ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/invoice/${id}`)}
                        disabled={processing}
                        className="bg-gray-600 text-white px-6 py-2 rounded font-bold"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
