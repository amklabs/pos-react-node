// src/pages/CashReceived.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import DateField from '../components/DateField.jsx';
import Spinner from '../components/Spinner.jsx';
import Pagination from '../components/Pagination.jsx';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';
import { formatNumber, formatDate, toInputDate } from '../utils/formaters.js';

const PAGE_SIZE = 10;

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
    const confirm = useConfirm();

    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [towns, setTowns] = useState([]);
    const [unpaidInvoices, setUnpaidInvoices] = useState([]);
    const [loadingUnpaid, setLoadingUnpaid] = useState(false);
    const [records, setRecords] = useState([]);
    const [loadingMaster, setLoadingMaster] = useState(true);
    const [loadingRecords, setLoadingRecords] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState(0);
    const [selectedIds, setSelectedIds] = useState(() => new Set());

    const debouncedSearch = useDebouncedValue(search, 350);

    const fetchMaster = useCallback(async () => {
        try {
            setLoadingMaster(true);
            const [custRes, townRes] = await Promise.all([
                apiClient.get(`/api/customers`),
                apiClient.get(`/api/towns`),
            ]);
            setCustomers(custRes.data || []);
            setTowns(townRes.data || []);
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load form data');
        } finally {
            setLoadingMaster(false);
        }
    }, []);

    const fetchRecords = useCallback(async () => {
        try {
            setLoadingRecords(true);
            const res = await apiClient.get('/api/cash', {
                params: {
                    page,
                    pageSize: PAGE_SIZE,
                    q: debouncedSearch.trim() || undefined,
                },
            });
            setRecords(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
            setTotalAmount(Number(res.data.totalAmount || 0));
            setSelectedIds(new Set());
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load cash records');
        } finally {
            setLoadingRecords(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => {
        fetchMaster();
    }, [fetchMaster]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        if (!formData.customerId || editingId) {
            if (!formData.customerId) setUnpaidInvoices([]);
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
    }, [formData.customerId, editingId]);

    const filteredCustomers = useMemo(() => {
        if (!formData.townId) return customers;
        return customers.filter((c) => String(c.townId) === String(formData.townId));
    }, [customers, formData.townId]);

    const selectedInvoice = useMemo(
        () => unpaidInvoices.find((i) => String(i.id) === String(formData.invoiceId)) || null,
        [unpaidInvoices, formData.invoiceId]
    );

    const pageIds = useMemo(() => records.map((r) => r.id), [records]);
    const allPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const somePageSelected =
        pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

    const toggleOne = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllPage = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allPageSelected) pageIds.forEach((id) => next.delete(id));
            else pageIds.forEach((id) => next.add(id));
            return next;
        });
    };

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
        setEditingId(null);
    };

    const startEdit = (rec) => {
        if (rec.invoiceId || rec.linkedToInvoice) {
            toastWarning(
                `Linked to invoice #${rec.invoice?.invoiceNo || rec.invoiceId}. Edit the invoice instead.`
            );
            return;
        }
        setEditingId(rec.id);
        setUnpaidInvoices([]);
        setFormData({
            date: toInputDate(rec.date),
            townId: rec.customer?.townId ? String(rec.customer.townId) : '',
            customerId: rec.customerId ? String(rec.customerId) : '',
            invoiceId: '',
            amount: String(rec.amount ?? ''),
            note: rec.note || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (!editingId && selectedInvoice && amount > selectedInvoice.balance + 0.001) {
            toastWarning(
                `Amount exceeds invoice balance (${formatNumber(selectedInvoice.balance)}). Adjust or leave unallocated.`
            );
            return;
        }

        try {
            setSaving(true);
            if (editingId) {
                await apiClient.put(`/api/cash/${editingId}`, {
                    date: formData.date || undefined,
                    customerId: formData.customerId,
                    amount,
                    note: formData.note || undefined,
                });
                toastSuccess('Cash entry updated');
            } else {
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
            }
            resetForm();
            await fetchRecords();
        } catch (err) {
            toastError(err.response?.data?.error || 'Error saving cash record');
        } finally {
            setSaving(false);
        }
    };

    const deleteSelected = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;

        const linkedCount = records.filter(
            (r) => selectedIds.has(r.id) && (r.invoiceId || r.linkedToInvoice)
        ).length;

        const ok = await confirm({
            title: `Delete ${ids.length} cash entr${ids.length === 1 ? 'y' : 'ies'}?`,
            message:
                linkedCount > 0
                    ? `${linkedCount} of the selected entries are linked to invoices. Deleting them will update those invoices' paid amounts. This cannot be undone.`
                    : 'This permanently deletes the selected cash received records. This cannot be undone.',
            confirmLabel: 'Delete selected',
        });
        if (!ok) return;

        setDeleting(true);
        try {
            const res = await apiClient.post('/api/cash/bulk-delete', { ids });
            toastSuccess(res.data.message || 'Cash records deleted');
            if (editingId && selectedIds.has(editingId)) resetForm();
            setSelectedIds(new Set());
            await fetchRecords();
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to delete cash records');
        } finally {
            setDeleting(false);
        }
    };

    const isEditing = Boolean(editingId);

    return (
        <div className="w-full min-w-0">
            <div className="bg-white p-4 rounded-lg border shadow-lg border-t-4 border-green-600 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                        <h1 className="text-xl font-bold">
                            {isEditing ? 'Edit Cash Entry' : 'New Cash Entry'}
                        </h1>
                        <p className="text-xs text-gray-500">
                            {isEditing
                                ? 'Update an unallocated account credit. Invoice-linked payments cannot be edited here.'
                                : 'Record customer payments. Optionally allocate to an unpaid sale invoice.'}
                        </p>
                    </div>
                    <Link
                        to="/ledger"
                        className="text-sm text-blue-600 hover:underline print:hidden"
                    >
                        Customer ledger →
                    </Link>
                </div>

                {loadingMaster ? (
                    <div className="py-8">
                        <Spinner size="md" label="Loading form..." />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
                            <div>
                                <label className="block text-xs font-semibold mb-0.5">Date</label>
                                <DateField
                                    value={formData.date}
                                    onChange={(date) => setFormData({ ...formData, date })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-0.5">
                                    Town
                                </label>
                                <select
                                    className="border rounded-input w-full "
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
                                <label className="block text-xs font-semibold mb-0.5">
                                    Customer
                                </label>
                                <select
                                    className="border rounded-input w-full "
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
                            </div>
                            {!isEditing && (
                                <div>
                                    <label className="block text-xs font-semibold mb-0.5">
                                        Invoice
                                    </label>
                                    <select
                                        className="border rounded-input w-full"
                                        value={formData.invoiceId}
                                        onChange={(e) => handleInvoiceChange(e.target.value)}
                                        disabled={!formData.customerId || loadingUnpaid}
                                    >
                                        <option value="">
                                            {loadingUnpaid
                                                ? 'Loading…'
                                                : 'Unallocated'}
                                        </option>
                                        {unpaidInvoices.map((inv) => (
                                            <option key={inv.id} value={inv.id}>
                                                #{inv.invoiceNo} ·{' '}
                                                {formatNumber(inv.balance)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold mb-0.5">
                                    Amount
                                </label>
                                <div className="flex gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="Rs."
                                        className="borderrounded-input w-full"
                                        value={formData.amount}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                amount: e.target.value,
                                            })
                                        }
                                    />
                                    {!isEditing && (
                                        <button
                                            type="button"
                                            className="border px-2 rounded-input text-xs font-semibold text-green-700 hover:bg-green-50 shrink-0 disabled:opacity-50 cursor-pointer"
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
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-0.5">Note</label>
                                <input
                                    type="text"
                                    placeholder="Optional"
                                    className="border rounded-input w-full"
                                    value={formData.note}
                                    onChange={(e) =>
                                        setFormData({ ...formData, note: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        {selectedInvoice && !isEditing && (
                            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 bg-green-50 border border-green-200 rounded-input px-3 py-1.5 text-xs">
                                <span>
                                    <span className="text-gray-500">Invoice </span>
                                    <strong>#{selectedInvoice.invoiceNo}</strong>
                                </span>
                                <span>
                                    <span className="text-gray-500">Paid </span>
                                    <strong>
                                        {formatNumber(selectedInvoice.paidAmount)}
                                    </strong>
                                </span>
                                <span>
                                    <span className="text-gray-500">Balance </span>
                                    <strong className="text-red-600">
                                        {formatNumber(selectedInvoice.balance)}
                                    </strong>
                                </span>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 border-t pt-3">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="btn btn-primary bg-green-600"
                            >
                                {saving
                                    ? 'Saving…'
                                    : isEditing
                                      ? 'Update Entry'
                                      : 'Save Cash'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                                className="btn btn-secondary"
                            >
                                {isEditing ? 'Cancel edit' : 'Clear'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-4 rounded-lg border shadow">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                    <div>
                        <h2 className="text-lg font-bold">Cash received</h2>
                        <p className="text-sm text-gray-500">
                            {total} record{total === 1 ? '' : 's'}
                            {!loadingRecords && (
                                <> · Total Rs. {formatNumber(totalAmount)}</>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                className="btn btn-danger text-sm py-1.5"
                                disabled={deleting || loadingRecords}
                                onClick={deleteSelected}
                            >
                                {deleting
                                    ? 'Deleting…'
                                    : `Delete selected (${selectedIds.size})`}
                            </button>
                        )}
                        <input
                            type="search"
                            placeholder="Search customer, invoice, or note..."
                            className="border p-2 rounded-input w-full md:w-72 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-300">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-2 border w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = somePageSelected;
                                        }}
                                        onChange={toggleAllPage}
                                        disabled={loadingRecords || records.length === 0}
                                        aria-label="Select all on this page"
                                        className="cursor-pointer"
                                    />
                                </th>
                                <th className="p-2 border">Date</th>
                                <th className="p-2 border">Customer</th>
                                <th className="p-2 border">Invoice</th>
                                <th className="p-2 border text-right">Amount</th>
                                <th className="p-2 border">Note</th>
                                <th className="p-2 border text-center w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingRecords && (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500">
                                        <Spinner size="md" label="Loading records..." />
                                    </td>
                                </tr>
                            )}
                            {!loadingRecords &&
                                records.map((rec) => {
                                    const linked = Boolean(
                                        rec.invoiceId || rec.linkedToInvoice
                                    );
                                    const editTitle = linked
                                        ? `Linked to invoice #${rec.invoice?.invoiceNo || ''}. Edit the invoice to change this payment, or delete this entry.`
                                        : 'Edit entry';
                                    return (
                                        <tr
                                            key={rec.id}
                                            className={`border-b hover:bg-gray-50 ${
                                                selectedIds.has(rec.id) ? 'bg-blue-50/60' : ''
                                            } ${editingId === rec.id ? 'bg-amber-50' : ''}`}
                                        >
                                            <td className="p-2 border text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(rec.id)}
                                                    onChange={() => toggleOne(rec.id)}
                                                    aria-label={`Select cash entry ${rec.id}`}
                                                    className="cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-2 border">
                                                {formatDate(rec.date)}
                                            </td>
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
                                            <td className="p-2 border">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span
                                                        title={editTitle}
                                                        className="inline-flex"
                                                    >
                                                        <button
                                                            type="button"
                                                            title={editTitle}
                                                            disabled={linked}
                                                            onClick={() => startEdit(rec)}
                                                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                                                                linked
                                                                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                                                    : 'border-gray-200 bg-green-100 text-gray-700 hover:bg-green-200 cursor-pointer'
                                                            }`}
                                                        >
                                                            <Pencil size={14} aria-hidden />
                                                            Edit
                                                        </button>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        title="Delete entry"
                                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                                                        onClick={async () => {
                                                            setSelectedIds(new Set([rec.id]));
                                                            // slight delay so selection paints; reuse bulk confirm
                                                            const ok = await confirm({
                                                                title: 'Delete cash entry?',
                                                                message: linked
                                                                    ? `This payment is linked to invoice #${rec.invoice?.invoiceNo}. Deleting it will update that invoice's paid amount. This cannot be undone.`
                                                                    : 'This permanently deletes this cash received record. This cannot be undone.',
                                                                confirmLabel: 'Delete',
                                                            });
                                                            if (!ok) {
                                                                setSelectedIds(new Set());
                                                                return;
                                                            }
                                                            setDeleting(true);
                                                            try {
                                                                const res = await apiClient.post(
                                                                    '/api/cash/bulk-delete',
                                                                    { ids: [rec.id] }
                                                                );
                                                                toastSuccess(
                                                                    res.data.message ||
                                                                        'Cash record deleted'
                                                                );
                                                                if (editingId === rec.id) {
                                                                    resetForm();
                                                                }
                                                                setSelectedIds(new Set());
                                                                await fetchRecords();
                                                            } catch (err) {
                                                                toastError(
                                                                    err.response?.data?.error ||
                                                                        'Failed to delete'
                                                                );
                                                            } finally {
                                                                setDeleting(false);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} aria-hidden />
                                                        Del
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            {!loadingRecords && records.length === 0 && (
                                <tr>
                                    <td
                                        colSpan="7"
                                        className="p-4 text-center text-gray-500"
                                    >
                                        No cash received records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    disabled={loadingRecords}
                />
            </div>
        </div>
    );
}
