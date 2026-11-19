// src/pages/CashReceived.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import DateField from '../components/DateField.jsx';
import Spinner from '../components/Spinner.jsx';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';
import { formatNumber, formatDate, toInputDate } from '../utils/formaters.js';

function emptyForm() {
    return {
        date: toInputDate(new Date()),
        townId: '',
        customerId: '',
        invoiceId: '',
        amount: '',
        note: '',
    };
}

export default function CashReceived() {
    usePageTitle('Cash Received');

    const [formData, setFormData] = useState(emptyForm);
    const [customers, setCustomers] = useState([]);
    const [towns, setTowns] = useState([]);
    const [unpaidInvoices, setUnpaidInvoices] = useState([]);
    const [loadingUnpaid, setLoadingUnpaid] = useState(false);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [custRes, cashRes, townRes] = await Promise.all([
                apiClient.get(`/api/customers`),
                apiClient.get(`/api/cash`),
                apiClient.get(`/api/towns`),
            ]);
            setCustomers(custRes.data || []);
            setTowns(townRes.data || []);
            setRecords((cashRes.data || []).filter((r) => r.type === 'RECEIVED'));
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load cash data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!formData.customerId) {
            setUnpaidInvoices([]);
            setFormData((prev) =>
                prev.invoiceId ? { ...prev, invoiceId: '', amount: prev.amount } : prev
            );
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setLoadingUnpaid(true);
                const res = await apiClient.get(
                    `/api/customers/${formData.customerId}/unpaid-invoices`
                );
                if (!cancelled) {
                    setUnpaidInvoices(res.data || []);
                    setFormData((prev) => ({ ...prev, invoiceId: '' }));
                }
            } catch (err) {
                if (!cancelled) {
                    setUnpaidInvoices([]);
                    toastError(err.response?.data?.error || 'Failed to load unpaid invoices');
                }
            } finally {
                if (!cancelled) setLoadingUnpaid(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [formData.customerId]);

    const filteredCustomers = useMemo(() => {
        if (!formData.townId) return customers;
        return customers.filter((c) => String(c.townId) === String(formData.townId));
    }, [customers, formData.townId]);

    const selectedInvoice = useMemo(
        () => unpaidInvoices.find((i) => String(i.id) === String(formData.invoiceId)) || null,
        [unpaidInvoices, formData.invoiceId]
    );

    const selectedCustomer = useMemo(
        () => customers.find((c) => String(c.id) === String(formData.customerId)) || null,
        [customers, formData.customerId]
    );

    const filteredRecords = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return records;
        return records.filter((rec) => {
            return (
                rec.customer?.name?.toLowerCase().includes(q) ||
                rec.invoice?.invoiceNo?.toLowerCase().includes(q) ||
                rec.note?.toLowerCase().includes(q)
            );
        });
    }, [records, search]);

    const receivedTotal = useMemo(
        () => filteredRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        [filteredRecords]
    );

    const handleTownChange = (townId) => {
        const stillValid = customers.some(
            (c) =>
                String(c.id) === String(formData.customerId) &&
                String(c.townId) === String(townId)
        );
        setFormData({
            ...formData,
            townId,
            customerId: stillValid ? formData.customerId : '',
            invoiceId: stillValid ? formData.invoiceId : '',
        });
    };

    const handleInvoiceChange = (invoiceId) => {
        const inv = unpaidInvoices.find((i) => String(i.id) === String(invoiceId));
        setFormData((prev) => ({
            ...prev,
            invoiceId,
            amount: inv ? String(inv.balance) : prev.amount,
        }));
    };

    const resetForm = () => {
        setFormData(emptyForm());
        setUnpaidInvoices([]);
    };

    const handleSave = async () => {
        if (!formData.customerId) {
            toastError('Select a customer');
            return;
        }
        const amount = Number(formData.amount);
        if (!(amount > 0)) {
            toastError('Enter an amount greater than 0');
            return;
        }
        if (selectedInvoice && amount > selectedInvoice.balance + 0.001) {
            toastWarning(
                `Amount exceeds invoice balance (${formatNumber(selectedInvoice.balance)}). Adjust or leave unallocated.`
            );
            return;
        }

        try {
            setSaving(true);
            await apiClient.post(`/api/cash`, {
                date: formData.date || undefined,
                customerId: formData.customerId,
                invoiceId: formData.invoiceId || undefined,
                amount,
                note: formData.note || undefined,
            });
            toastSuccess(
                selectedInvoice
                    ? `Payment recorded against #${selectedInvoice.invoiceNo}`
                    : 'Cash received and credited to customer account'
            );
            resetForm();
            await fetchData();
        } catch (err) {
            toastError(err.response?.data?.error || 'Error saving cash record');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-6xl">
            <div className="bg-white p-6 rounded-lg border shadow-lg border-t-4 border-green-600 mb-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Cash Received</h1>
                        <p className="text-sm text-gray-500">
                            Record customer payments. Optionally allocate to an unpaid sale invoice.
                        </p>
                    </div>
                    <Link
                        to="/ledger"
                        className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                        Customer ledger →
                    </Link>
                </div>

                {loading && customers.length === 0 ? (
                    <div className="py-12">
                        <Spinner size="md" label="Loading form..." />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Date</label>
                                <DateField
                                    value={formData.date}
                                    onChange={(date) => setFormData({ ...formData, date })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Town (filter)
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={formData.townId}
                                    onChange={(e) => handleTownChange(e.target.value)}
                                >
                                    <option value="">All towns</option>
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
                                    value={formData.customerId}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            customerId: e.target.value,
                                            invoiceId: '',
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
                                {formData.townId && filteredCustomers.length === 0 && (
                                    <p className="text-xs text-amber-700 mt-1">
                                        No customers in this town.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Allocate to invoice
                                </label>
                                <select
                                    className="border p-2 rounded-input w-full"
                                    value={formData.invoiceId}
                                    onChange={(e) => handleInvoiceChange(e.target.value)}
                                    disabled={!formData.customerId || loadingUnpaid}
                                >
                                    <option value="">
                                        {loadingUnpaid
                                            ? 'Loading unpaid invoices…'
                                            : 'Unallocated (customer account)'}
                                    </option>
                                    {unpaidInvoices.map((inv) => (
                                        <option key={inv.id} value={inv.id}>
                                            #{inv.invoiceNo} · bal. {formatNumber(inv.balance)} ·{' '}
                                            {inv.paymentStatus}
                                        </option>
                                    ))}
                                </select>
                                {formData.customerId &&
                                    !loadingUnpaid &&
                                    unpaidInvoices.length === 0 && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            No unpaid sales for this customer.
                                        </p>
                                    )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Amount</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="Rs."
                                        className="border p-2 rounded-input w-full"
                                        value={formData.amount}
                                        onChange={(e) =>
                                            setFormData({ ...formData, amount: e.target.value })
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="border px-3 rounded-input text-xs font-semibold text-green-700 hover:bg-green-50 shrink-0 disabled:opacity-50"
                                        disabled={!selectedInvoice}
                                        onClick={() =>
                                            setFormData({
                                                ...formData,
                                                amount: String(selectedInvoice.balance),
                                            })
                                        }
                                    >
                                        Full
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Note</label>
                                <input
                                    type="text"
                                    placeholder="Optional details"
                                    className="border p-2 rounded-input w-full"
                                    value={formData.note}
                                    onChange={(e) =>
                                        setFormData({ ...formData, note: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        {selectedInvoice && (
                            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-green-50 border border-green-200 rounded-input p-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Invoice</p>
                                    <p className="font-semibold">#{selectedInvoice.invoiceNo}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Total</p>
                                    <p className="font-semibold">
                                        Rs. {formatNumber(selectedInvoice.totalAmount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Already paid</p>
                                    <p className="font-semibold">
                                        Rs. {formatNumber(selectedInvoice.paidAmount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Balance due</p>
                                    <p className="font-bold text-red-600">
                                        Rs. {formatNumber(selectedInvoice.balance)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {selectedCustomer && !selectedInvoice && formData.customerId && (
                            <p className="text-xs text-gray-500 mb-4">
                                Payment will credit <strong>{selectedCustomer.name}</strong>
                                &apos;s account without linking a specific invoice.
                            </p>
                        )}

                        <div className="flex flex-wrap gap-3 border-t pt-4">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-green-600 text-white px-8 py-2 rounded-input font-bold hover:bg-green-700 disabled:opacity-60"
                            >
                                {saving ? 'Saving…' : 'Save Cash'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                                className="bg-gray-600 text-white px-6 py-2 rounded-input font-bold"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg border shadow">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Recent cash received</h2>
                        <p className="text-sm text-gray-500">
                            {filteredRecords.length} record
                            {filteredRecords.length === 1 ? '' : 's'}
                            {!loading && <> · Total Rs. {formatNumber(receivedTotal)}</>}
                        </p>
                    </div>
                    <input
                        type="search"
                        placeholder="Search customer, invoice, or note..."
                        className="border p-2 rounded-input w-full md:w-80"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-300">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-2 border">Date</th>
                                <th className="p-2 border">Customer</th>
                                <th className="p-2 border">Invoice</th>
                                <th className="p-2 border text-right">Amount</th>
                                <th className="p-2 border">Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        <Spinner size="md" label="Loading records..." />
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                filteredRecords.map((rec) => (
                                    <tr key={rec.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 border">{formatDate(rec.date)}</td>
                                        <td className="p-2 border font-medium">
                                            {rec.customer?.name || '—'}
                                        </td>
                                        <td className="p-2 border">
                                            {rec.invoice?.invoiceNo ? (
                                                <Link
                                                    to={`/invoice/${rec.invoiceId || rec.invoice.id}`}
                                                    className="text-blue-600 hover:underline font-semibold"
                                                >
                                                    #{rec.invoice.invoiceNo}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-gray-500">
                                                    Account credit
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2 border text-right font-semibold text-green-700">
                                            Rs. {formatNumber(rec.amount)}
                                        </td>
                                        <td className="p-2 border text-gray-600">
                                            {rec.note || '—'}
                                        </td>
                                    </tr>
                                ))}
                            {!loading && filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-4 text-center text-gray-500">
                                        No cash received records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
