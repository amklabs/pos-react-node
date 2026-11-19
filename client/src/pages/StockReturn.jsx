// src/pages/StockReturn.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import DateField from '../components/DateField.jsx';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';
import { formatNumber, formatDate } from '../utils/formaters.js';
import { STORE_NAME } from '../constants/store.js';

export default function StockReturn() {
    usePageTitle('Stock Return');

    const [saleQuery, setSaleQuery] = useState('');
    const [saleResults, setSaleResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [sale, setSale] = useState(null);
    const [lines, setLines] = useState([]); // { productId, productName, returnQty, rate, returnableQty, soldQty, alreadyReturned, lastSRate }
    const [date, setDate] = useState('');
    const [refundCash, setRefundCash] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [lastReturn, setLastReturn] = useState(null);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const printRef = useRef(null);

    const loadHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await apiClient.get('/api/returns', { params: { limit: 30 } });
            setHistory(res.data || []);
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load return history');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        const q = saleQuery.trim();
        if (q.length < 1) {
            setSaleResults([]);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                const res = await apiClient.get('/api/returns/sales', {
                    params: { q, limit: 20 },
                });
                if (!cancelled) setSaleResults(res.data || []);
            } catch (err) {
                if (!cancelled) {
                    toastError(err.response?.data?.error || 'Failed to search sales');
                }
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [saleQuery]);

    const selectSale = async (saleId) => {
        try {
            const res = await apiClient.get(`/api/returns/sales/${saleId}`);
            const data = res.data;
            setSale(data);
            setSaleQuery('');
            setSaleResults([]);
            setLastReturn(null);
            setLines(
                (data.lines || [])
                    .filter((l) => l.returnableQty > 0)
                    .map((l) => ({
                        productId: l.productId,
                        productName: l.productName,
                        soldQty: l.soldQty,
                        alreadyReturned: l.alreadyReturned,
                        returnableQty: l.returnableQty,
                        returnQty: l.returnableQty,
                        rate: l.rate,
                        lastSRate: l.lastSRate,
                        selected: true,
                    }))
            );
            if (!data.hasReturnable) {
                toastWarning('This sale has nothing left to return.');
            }
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load sale');
        }
    };

    const updateLine = (productId, patch) => {
        setLines((prev) =>
            prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l))
        );
    };

    const selectedLines = lines.filter((l) => l.selected && Number(l.returnQty) > 0);
    const grandTotal = selectedLines.reduce(
        (sum, l) => sum + Number(l.returnQty) * Number(l.rate),
        0
    );

    const resetForm = () => {
        setSale(null);
        setLines([]);
        setDate('');
        setRefundCash(false);
        setSaleQuery('');
        setSaleResults([]);
    };

    const handleSave = async () => {
        if (!sale) {
            toastError('Select an original sale invoice first.');
            return;
        }
        if (selectedLines.length === 0) {
            toastError('Select at least one product with qty to return.');
            return;
        }

        for (const line of selectedLines) {
            if (Number(line.returnQty) > Number(line.returnableQty) + 0.0001) {
                toastError(`Qty for "${line.productName}" exceeds returnable ${line.returnableQty}`);
                return;
            }
            if (Number(line.lastSRate) > 0 && Number(line.rate) > Number(line.lastSRate) * 1.25) {
                toastWarning(
                    `"${line.productName}" refund rate is much higher than last sale rate (${formatNumber(line.lastSRate)}).`
                );
            }
        }

        try {
            setProcessing(true);
            const res = await apiClient.post('/api/returns', {
                sourceInvoiceId: sale.id,
                date: date || undefined,
                refundCash,
                items: selectedLines.map((l) => ({
                    productId: l.productId,
                    qty: Number(l.returnQty),
                    rate: Number(l.rate),
                })),
            });
            toastSuccess(res.data?.message || 'Return processed');
            setLastReturn(res.data.returnInvoice);
            resetForm();
            await loadHistory();
        } catch (err) {
            toastError(err.response?.data?.error || 'Error processing return.');
        } finally {
            setProcessing(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="w-full min-w-0">
            <div className="bg-white p-6 rounded shadow border-t-4 border-red-500 print:hidden">
                <h1 className="text-2xl font-bold mb-2 text-red-600">Process Stock Return</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Select the original sale, return quantities (capped), and optionally pay cash from
                    the till. Refund amount = qty × rate (no discount).
                </p>

                {/* Sale picker */}
                {!sale && (
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-1">
                            Find original sale
                        </label>
                        <input
                            type="search"
                            className="border p-2 rounded-input w-full md:w-96"
                            placeholder="Search invoice #, customer name, or phone..."
                            value={saleQuery}
                            onChange={(e) => setSaleQuery(e.target.value)}
                        />
                        {searching && (
                            <div className="mt-2">
                                <Spinner size="sm" label="Searching..." />
                            </div>
                        )}
                        {saleResults.length > 0 && (
                            <div className="mt-2 border rounded overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2">Invoice</th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Customer</th>
                                            <th className="p-2">Town</th>
                                            <th className="p-2 text-right">Amount</th>
                                            <th className="p-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saleResults.map((s) => (
                                            <tr key={s.id} className="border-t hover:bg-gray-50">
                                                <td className="p-2 font-semibold">{s.invoiceNo}</td>
                                                <td className="p-2">{formatDate(s.date)}</td>
                                                <td className="p-2">
                                                    {s.customerName || '—'}
                                                    {s.phone && (
                                                        <span className="text-gray-400 text-xs">
                                                            {' '}
                                                            ({s.phone})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2">{s.townName || '—'}</td>
                                                <td className="p-2 text-right">
                                                    {formatNumber(s.totalAmount)}
                                                </td>
                                                <td className="p-2">
                                                    <button
                                                        type="button"
                                                        className="text-blue-600 hover:underline font-semibold"
                                                        onClick={() => selectSale(s.id)}
                                                    >
                                                        Select
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Selected sale + lines */}
                {sale && (
                    <>
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <p className="font-bold text-lg">
                                    Sale #{sale.invoiceNo}{' '}
                                    <Link
                                        to={`/invoice/${sale.id}`}
                                        className="text-sm text-blue-600 font-normal hover:underline"
                                    >
                                        View
                                    </Link>
                                </p>
                                <p className="text-sm text-gray-600">
                                    {sale.customer?.name} · {sale.town?.name} ·{' '}
                                    {formatDate(sale.date)} · Total {formatNumber(sale.totalAmount)}
                                </p>
                            </div>
                            <div className="flex items-end gap-3">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Return date
                                    </label>
                                    <DateField value={date} onChange={setDate} className="w-44" />
                                </div>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="text-sm text-gray-600 hover:underline mb-2"
                                >
                                    Change sale
                                </button>
                            </div>
                        </div>

                        <table className="w-full mb-6 border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="p-2 border w-10"></th>
                                    <th className="p-2 border">Product</th>
                                    <th className="p-2 border text-right">Sold</th>
                                    <th className="p-2 border text-right">Already returned</th>
                                    <th className="p-2 border text-right">Returnable</th>
                                    <th className="p-2 border text-right">Return qty</th>
                                    <th className="p-2 border text-right">Refund rate</th>
                                    <th className="p-2 border text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line) => {
                                    const amount = Number(line.returnQty || 0) * Number(line.rate || 0);
                                    const rateHigh =
                                        Number(line.lastSRate) > 0 &&
                                        Number(line.rate) > Number(line.lastSRate) * 1.25;
                                    return (
                                        <tr
                                            key={line.productId}
                                            className={`border-b ${line.selected ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
                                        >
                                            <td className="p-2 border text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={line.selected}
                                                    onChange={(e) =>
                                                        updateLine(line.productId, {
                                                            selected: e.target.checked,
                                                        })
                                                    }
                                                />
                                            </td>
                                            <td className="p-2 border font-medium">
                                                {line.productName}
                                            </td>
                                            <td className="p-2 border text-right">
                                                {formatNumber(line.soldQty)}
                                            </td>
                                            <td className="p-2 border text-right">
                                                {formatNumber(line.alreadyReturned)}
                                            </td>
                                            <td className="p-2 border text-right font-semibold">
                                                {formatNumber(line.returnableQty)}
                                            </td>
                                            <td className="p-2 border text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={line.returnableQty}
                                                    step="any"
                                                    disabled={!line.selected}
                                                    className="border p-1 rounded-input w-24 text-right"
                                                    value={line.returnQty}
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value === ''
                                                                ? ''
                                                                : parseFloat(e.target.value);
                                                        updateLine(line.productId, { returnQty: v });
                                                    }}
                                                />
                                            </td>
                                            <td className="p-2 border text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    disabled={!line.selected}
                                                    className={`border p-1 rounded-input w-28 text-right ${rateHigh ? 'border-amber-500 bg-amber-50' : ''}`}
                                                    value={line.rate}
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value === ''
                                                                ? ''
                                                                : parseFloat(e.target.value);
                                                        updateLine(line.productId, { rate: v });
                                                    }}
                                                    title={
                                                        rateHigh
                                                            ? `Above last sale rate ${formatNumber(line.lastSRate)}`
                                                            : undefined
                                                    }
                                                />
                                            </td>
                                            <td className="p-2 border text-right font-bold text-red-600">
                                                {formatNumber(amount)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {lines.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="p-4 text-center text-gray-500">
                                            No returnable products on this sale.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-t pt-4">
                            <div>
                                <div className="text-xl font-bold mb-3">
                                    Return Total:{' '}
                                    <span className="text-red-600">
                                        Rs. {formatNumber(grandTotal)}
                                    </span>
                                </div>
                                <label className="flex items-start gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={refundCash}
                                        onChange={(e) => setRefundCash(e.target.checked)}
                                    />
                                    <span>
                                        <span className="font-semibold">
                                            Pay cash refund from till
                                        </span>
                                        <span className="block text-gray-500">
                                            Leave unchecked to credit the customer account only.
                                        </span>
                                    </span>
                                </label>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={processing || lines.length === 0}
                                    className="bg-red-600 text-white px-8 py-2 rounded font-bold hover:bg-red-700 disabled:opacity-60"
                                >
                                    {processing ? 'Processing…' : 'Process Return'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    disabled={processing}
                                    className="bg-gray-600 text-white px-8 py-2 rounded font-bold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Last return print slip */}
            {lastReturn && (
                <div
                    ref={printRef}
                    className="mt-6 bg-white p-8 rounded shadow border print:shadow-none print:border-0"
                >
                    <div className="flex justify-between items-start mb-6 print:hidden">
                        <h2 className="text-xl font-bold text-red-600">Return note created</h2>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="bg-gray-800 text-white px-4 py-2 rounded font-semibold"
                        >
                            Print
                        </button>
                    </div>
                    <div className="border-b pb-4 mb-4">
                        <p className="text-sm font-bold uppercase text-gray-700 mb-1">{STORE_NAME}</p>
                        <h2 className="text-2xl font-bold uppercase">Stock Return</h2>
                        <p>
                            Return #: <strong>{lastReturn.invoiceNo}</strong>
                        </p>
                        <p>Date: {formatDate(lastReturn.date)}</p>
                        {lastReturn.sourceInvoice && (
                            <p>
                                Against sale:{' '}
                                <strong>#{lastReturn.sourceInvoice.invoiceNo}</strong>
                            </p>
                        )}
                        <p>Customer: {lastReturn.customer?.name}</p>
                        <p>Town: {lastReturn.town?.name}</p>
                    </div>
                    <table className="w-full text-sm border-collapse mb-4">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 border text-left">Product</th>
                                <th className="p-2 border text-right">Qty</th>
                                <th className="p-2 border text-right">Rate</th>
                                <th className="p-2 border text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(lastReturn.items || []).map((item) => (
                                <tr key={item.id}>
                                    <td className="p-2 border">{item.product?.name}</td>
                                    <td className="p-2 border text-right">
                                        {formatNumber(item.qty)}
                                    </td>
                                    <td className="p-2 border text-right">
                                        {formatNumber(item.rate)}
                                    </td>
                                    <td className="p-2 border text-right font-semibold">
                                        {formatNumber(item.total ?? Number(item.qty) * Number(item.rate))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-right text-xl font-bold">
                        Total: Rs. {formatNumber(lastReturn.totalAmount)}
                    </div>
                </div>
            )}

            {/* History */}
            <div className="mt-8 bg-white p-6 rounded shadow print:hidden">
                <h2 className="text-xl font-bold mb-4">Recent returns</h2>
                {historyLoading ? (
                    <Spinner size="md" label="Loading history..." />
                ) : (
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-2 border">Return #</th>
                                <th className="p-2 border">Date</th>
                                <th className="p-2 border">Customer</th>
                                <th className="p-2 border">Against sale</th>
                                <th className="p-2 border text-right">Amount</th>
                                <th className="p-2 border">Cash refund</th>
                                <th className="p-2 border">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((r) => (
                                <tr key={r.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 border font-semibold">{r.invoiceNo}</td>
                                    <td className="p-2 border">{formatDate(r.date)}</td>
                                    <td className="p-2 border">{r.customer?.name || '—'}</td>
                                    <td className="p-2 border">
                                        {r.sourceInvoice ? (
                                            <Link
                                                to={`/invoice/${r.sourceInvoice.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                #{r.sourceInvoice.invoiceNo}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="p-2 border text-right font-semibold text-red-600">
                                        {formatNumber(r.totalAmount)}
                                    </td>
                                    <td className="p-2 border">
                                        {r.cashRefunded ? (
                                            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                                Yes
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-500">Account credit</span>
                                        )}
                                    </td>
                                    <td className="p-2 border">
                                        <Link
                                            to={`/invoice/${r.id}`}
                                            className="text-blue-600 hover:underline font-semibold"
                                        >
                                            View / Print
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-4 text-center text-gray-500">
                                        No returns yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
