// src/pages/InvoiceLookup.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import Pagination from '../components/Pagination.jsx';
import DateField from '../components/DateField.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { useAuthContext } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';
import { toastSuccess, toastError } from '../utils/toast';
import { formatNumber, formatDate } from '../utils/formaters.js';
import { Eye, Pencil } from 'lucide-react';

const PAGE_SIZE = 10;

export default function InvoiceLookup() {
    usePageTitle('Invoice Lookup');
    const confirm = useConfirm();
    const { user } = useAuthContext();
    const canDelete = isAdmin(user);

    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [deleting, setDeleting] = useState(false);

    const debouncedSearch = useDebouncedValue(searchTerm, 350);

    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/api/invoices', {
                params: {
                    page,
                    pageSize: PAGE_SIZE,
                    q: debouncedSearch.trim() || undefined,
                    type: typeFilter !== 'all' ? typeFilter : undefined,
                    paymentStatus:
                        paymentFilter !== 'all' ? paymentFilter : undefined,
                    from: fromDate || undefined,
                    to: toDate || undefined,
                },
            });
            setInvoices(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
            setTotalAmount(Number(res.data.totalAmount || 0));
            setSelectedIds(new Set());
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, typeFilter, paymentFilter, fromDate, toDate]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, typeFilter, paymentFilter, fromDate, toDate]);

    const pageIds = useMemo(() => invoices.map((inv) => inv.id), [invoices]);
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
            if (allPageSelected) {
                pageIds.forEach((id) => next.delete(id));
            } else {
                pageIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const deleteSelected = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;

        const ok = await confirm({
            title: `Delete ${ids.length} invoice${ids.length === 1 ? '' : 's'}?`,
            message:
                'This permanently deletes the selected invoices, their line items, and linked cash records. Related stock returns will also be removed. This cannot be undone.',
            confirmLabel: 'Delete selected',
        });
        if (!ok) return;

        setDeleting(true);
        try {
            const res = await apiClient.post('/api/invoices/bulk-delete', { ids });
            toastSuccess(res.data.message || 'Invoices deleted');
            setSelectedIds(new Set());
            await fetchInvoices();
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to delete invoices');
        } finally {
            setDeleting(false);
        }
    };

    const colSpan = canDelete ? 10 : 9;

    return (
        <div className="w-full min-w-0 max-w-6xl">
            <div className="mb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Invoice Lookup</h1>
                    <p className="text-sm text-gray-500">
                        {total} invoice{total === 1 ? '' : 's'}
                        {!loading && (
                            <> · Total Rs. {formatNumber(totalAmount)}</>
                        )}
                    </p>
                </div>
                {canDelete && selectedIds.size > 0 && (
                    <button
                        type="button"
                        className="btn btn-danger text-sm py-1.5 px-4"
                        disabled={deleting || loading}
                        onClick={deleteSelected}
                    >
                        {deleting
                            ? 'Deleting…'
                            : `Delete selected (${selectedIds.size})`}
                    </button>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4 space-y-3 print:hidden">
                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold mb-1">Search</label>
                        <input
                            type="search"
                            placeholder="Invoice #, customer, town, salesman…"
                            className="border p-2 rounded-input w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Type</label>
                        <select
                            className="border p-2 rounded-input min-w-35"
                            value={typeFilter}
                            onChange={(e) => {
                                const next = e.target.value;
                                setTypeFilter(next);
                                if (next === 'RETURN') setPaymentFilter('all');
                            }}
                        >
                            <option value="all">Sale &amp; Return</option>
                            <option value="SALE">Sale</option>
                            <option value="RETURN">Return</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Payment</label>
                        <select
                            className="border p-2 rounded-input min-w-35"
                            value={paymentFilter}
                            disabled={typeFilter === 'RETURN'}
                            onChange={(e) => {
                                const next = e.target.value;
                                setPaymentFilter(next);
                                if (next !== 'all' && typeFilter === 'RETURN') {
                                    setTypeFilter('SALE');
                                }
                            }}
                        >
                            <option value="all">All</option>
                            <option value="Paid">Paid</option>
                            <option value="PartialPaid">Partial</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="block text-sm font-semibold mb-1">From</label>
                            <DateField
                                value={fromDate}
                                onChange={setFromDate}
                                max={toDate || undefined}
                                className="w-44"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">To</label>
                            <DateField
                                value={toDate}
                                onChange={setToDate}
                                min={fromDate || undefined}
                                className="w-44"
                            />
                        </div>
                        {(fromDate ||
                            toDate ||
                            searchTerm ||
                            typeFilter !== 'all' ||
                            paymentFilter !== 'all') && (
                            <button
                                type="button"
                                className="btn btn-secondary text-sm py-1.5 px-4"
                                onClick={() => {
                                    setSearchTerm('');
                                    setTypeFilter('all');
                                    setPaymentFilter('all');
                                    setFromDate('');
                                    setToDate('');
                                    setPage(1);
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white mb-2">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            {canDelete && (
                                <th className="p-2 border w-10 text-center">
                                    <input
                                        className="w-4 h-4"
                                        type="checkbox"
                                        checked={allPageSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = somePageSelected;
                                        }}
                                        onChange={toggleAllPage}
                                        disabled={loading || invoices.length === 0}
                                        aria-label="Select all on this page"
                                    />
                                </th>
                            )}
                            <th className="p-2 border">Invoice No.</th>
                            <th className="p-2 border">Date</th>
                            <th className="p-2 border">Type</th>
                            <th className="p-2 border">Customer</th>
                            <th className="p-2 border">Town</th>
                            <th className="p-2 border">Salesman</th>
                            <th className="p-2 border">Payment</th>
                            <th className="p-2 border text-end pe-4">Total</th>
                            <th className="p-2 border text-center w-36">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={colSpan} className="p-8 text-center text-gray-500">
                                    <Spinner size="md" label="Loading invoices..." />
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            invoices.map((inv) => (
                                <tr
                                    key={inv.id}
                                    className={`border-b hover:bg-gray-50 ${
                                        selectedIds.has(inv.id) ? 'bg-blue-50/60' : ''
                                    }`}
                                >
                                    {canDelete && (
                                        <td className="p-2 border text-center">
                                            <input
                                                className="w-4 h-4"
                                                type="checkbox"
                                                checked={selectedIds.has(inv.id)}
                                                onChange={() => toggleOne(inv.id)}
                                                aria-label={`Select invoice ${inv.invoiceNo}`}
                                            />
                                        </td>
                                    )}
                                    <td className="p-2 border font-semibold">
                                        {inv.invoiceNo}
                                    </td>
                                    <td className="p-2 border">{formatDate(inv.date)}</td>
                                    <td className="p-2 border">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                                inv.type === 'SALE'
                                                    ? 'bg-green-100 text-green-800'
                                                    : inv.type === 'RETURN'
                                                      ? 'bg-red-100 text-red-800'
                                                      : 'bg-blue-100 text-blue-800'
                                            }`}
                                        >
                                            {inv.type}
                                        </span>
                                    </td>
                                    <td className="p-2 border">
                                        {inv.customer?.name ||
                                            inv.company?.name ||
                                            '—'}
                                    </td>
                                    <td className="p-2 border">{inv.town?.name || '—'}</td>
                                    <td className="p-2 border">
                                        {inv.salesman?.name || '—'}
                                    </td>
                                    <td className="p-2 border">
                                        {inv.type === 'SALE' ? (
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-bold ${
                                                    inv.paymentStatus === 'Paid'
                                                        ? 'bg-green-100 text-green-800'
                                                        : inv.paymentStatus ===
                                                            'PartialPaid'
                                                          ? 'bg-amber-100 text-amber-800'
                                                          : 'bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {inv.paymentStatus || 'Pending'}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="p-2 border font-bold text-end pe-4">
                                        {formatNumber(inv.totalAmount)}
                                    </td>
                                    <td className="p-2 border">
                                        <div className="flex items-center justify-start gap-1.5">
                                            <Link
                                                to={`/invoice/${inv.id}`}
                                                title="View / Print"
                                                className="btn btn-secondary text-xs py-1 px-2"
                                            >
                                                <Eye size={14} aria-hidden />
                                                View
                                            </Link>
                                            {(inv.type === 'SALE' ||
                                                (inv.type === 'PURCHASE' &&
                                                    canDelete)) && (
                                                <Link
                                                    to={`/invoice/${inv.id}/edit`}
                                                    title="Edit invoice"
                                                    className="btn btn-primary text-xs py-1 px-2"
                                                >
                                                    <Pencil size={14} aria-hidden />
                                                    Edit
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        {!loading && invoices.length === 0 && (
                            <tr>
                                <td
                                    colSpan={colSpan}
                                    className="p-4 text-center text-gray-500"
                                >
                                    No invoices found.
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
                disabled={loading}
            />
        </div>
    );
}
