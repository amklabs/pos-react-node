// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ShoppingCart,
    ShoppingBag,
    Wallet,
    RotateCcw,
    Package,
    Search,
    BookOpen,
    RefreshCw,
    TrendingUp,
    Banknote,
    AlertTriangle,
    CircleDollarSign,
} from 'lucide-react';
import apiClient from '../apiClient.js';
import Spinner from '../components/Spinner.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { useAuthContext } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';
import { STORE_NAME } from '../constants/store.js';
import { toastError } from '../utils/toast';
import { formatNumber, formatDate, formatDateTime } from '../utils/formaters.js';

function money(value) {
    return `Rs. ${formatNumber(value)}`;
}

function PaymentBadge({ status }) {
    const s = status || 'Pending';
    const styles =
        s === 'Paid'
            ? 'bg-green-100 text-green-800'
            : s === 'PartialPaid'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800';
    const label = s === 'PartialPaid' ? 'Partial' : s;
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles}`}>
            {label}
        </span>
    );
}

function StatCard({ label, value, hint, to, linkLabel, accent, icon: Icon }) {
    return (
        <div
            className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 ${accent} flex flex-col justify-between min-h-[132px]`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                        {label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 tabular-nums break-all">
                        {value}
                    </p>
                    {hint ? (
                        <p className="text-xs text-gray-500 mt-1">{hint}</p>
                    ) : null}
                </div>
                {Icon ? (
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                        <Icon size={20} />
                    </div>
                ) : null}
            </div>
            {to ? (
                <Link
                    to={to}
                    className="text-brand-700 text-sm mt-4 hover:underline font-medium w-fit"
                >
                    {linkLabel || 'View details'} →
                </Link>
            ) : (
                <span className="mt-4 h-5" />
            )}
        </div>
    );
}

function ActionLink({ to, icon: Icon, label, className }) {
    return (
        <Link
            to={to}
            className={`flex items-center gap-3 p-3.5 rounded-lg font-semibold text-sm transition border ${className}`}
        >
            <Icon size={18} className="shrink-0" />
            <span>{label}</span>
        </Link>
    );
}

export default function Dashboard() {
    usePageTitle('Dashboard');
    const { user } = useAuthContext();
    const admin = isAdmin(user);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboard = useCallback(async ({ silent } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await apiClient.get(`/api/dashboard`);
            setStats(res.data);
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[70vh] p-5">
                <Spinner label="Loading dashboard..." />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="w-full min-w-0 mx-auto">
                <p className="text-red-600 mb-3">Could not load dashboard data.</p>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fetchDashboard()}
                >
                    Retry
                </button>
            </div>
        );
    }

    const displayName = user?.name || user?.username || 'there';
    const todayLabel = formatDate(new Date());

    return (
        <div className="w-full min-w-0 max-w-6xl space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                        {STORE_NAME}
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                        Welcome back, {displayName}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Business overview for {todayLabel}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-secondary self-start sm:self-auto"
                    onClick={() => fetchDashboard({ silent: true })}
                    disabled={refreshing}
                >
                    <RefreshCw
                        size={16}
                        className={refreshing ? 'animate-spin' : ''}
                    />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {/* Primary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    label="Today's Sales"
                    value={money(stats.todaySales)}
                    hint={`${stats.todaySalesCount || 0} invoice${stats.todaySalesCount === 1 ? '' : 's'}`}
                    to="/reports/sales"
                    linkLabel="Sales report"
                    accent="border-blue-500"
                    icon={TrendingUp}
                />
                <StatCard
                    label="Cash in Hand"
                    value={money(stats.totalCash)}
                    hint={`Received today: ${money(stats.todayCashReceived)}`}
                    to="/reports/cash"
                    linkLabel="Cash summary"
                    accent={
                        Number(stats.totalCash) >= 0
                            ? 'border-green-500'
                            : 'border-red-500'
                    }
                    icon={Banknote}
                />
                <StatCard
                    label="Outstanding"
                    value={money(stats.outstandingReceivables)}
                    hint={`${stats.unpaidInvoiceCount || 0} unpaid sale${stats.unpaidInvoiceCount === 1 ? '' : 's'}`}
                    to="/ledger"
                    linkLabel="Customer ledger"
                    accent="border-amber-500"
                    icon={CircleDollarSign}
                />
                <StatCard
                    label="Active Products"
                    value={formatNumber(stats.totalProducts, {
                        maximumFractionDigits: 0,
                    })}
                    hint={
                        stats.lowStockItems?.length
                            ? `${stats.lowStockItems.length} below ${stats.lowStockThreshold || 10} qty`
                            : 'Stock levels look healthy'
                    }
                    to="/reports/stock"
                    linkLabel="Stock report"
                    accent="border-slate-500"
                    icon={Package}
                />
            </div>

            {/* Secondary today strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Today purchases</span>
                    <span className="font-semibold tabular-nums">
                        {money(stats.todayPurchases)}
                    </span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Today returns</span>
                    <span className="font-semibold tabular-nums">
                        {money(stats.todayReturns)}
                    </span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Today cash in</span>
                    <span className="font-semibold tabular-nums text-green-700">
                        {money(stats.todayCashReceived)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Quick actions */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-brand-600">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        Quick actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                        <ActionLink
                            to="/sale"
                            icon={ShoppingCart}
                            label="New sale"
                            className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                        />
                        {admin && (
                            <ActionLink
                                to="/purchase"
                                icon={ShoppingBag}
                                label="New purchase"
                                className="bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
                            />
                        )}
                        <ActionLink
                            to="/cash"
                            icon={Wallet}
                            label="Receive cash"
                            className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100"
                        />
                        <ActionLink
                            to="/return"
                            icon={RotateCcw}
                            label="Stock return"
                            className="bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
                        />
                        <ActionLink
                            to="/invoice-lookup"
                            icon={Search}
                            label="Invoice lookup"
                            className="bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                        />
                        <ActionLink
                            to="/ledger"
                            icon={BookOpen}
                            label="Customer ledger"
                            className="bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                        />
                    </div>
                </div>

                {/* Low stock */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-red-500 lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500" />
                            Low stock
                            <span className="text-sm font-normal text-gray-400">
                                (below {stats.lowStockThreshold || 10})
                            </span>
                        </h2>
                        <Link
                            to="/reports/stock"
                            className="text-sm text-brand-700 hover:underline font-medium"
                        >
                            Full stock report →
                        </Link>
                    </div>

                    {!stats.lowStockItems?.length ? (
                        <div className="text-center py-10 text-gray-500 text-sm">
                            All active products are at healthy stock levels.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left p-2.5 border-b">
                                            Product
                                        </th>
                                        <th className="text-right p-2.5 border-b">
                                            Balance
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.lowStockItems.map((item) => (
                                        <tr
                                            key={item.id || item.name}
                                            className="border-b last:border-0 hover:bg-gray-50"
                                        >
                                            <td className="p-2.5 font-medium text-gray-800">
                                                {item.name}
                                            </td>
                                            <td className="p-2.5 text-right">
                                                <span
                                                    className={`inline-block py-0.5 px-2.5 rounded text-xs font-bold ${
                                                        Number(item.balance) <= 0
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {formatNumber(item.balance)} left
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent sales */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-blue-500">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        Recent sales
                    </h2>
                    <Link
                        to="/invoice-lookup"
                        className="text-sm text-brand-700 hover:underline font-medium"
                    >
                        Invoice lookup →
                    </Link>
                </div>

                {!stats.recentSales?.length ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                        No sales yet. Create your first sale to see it here.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-2.5 border-b">
                                        Invoice
                                    </th>
                                    <th className="text-left p-2.5 border-b">
                                        Date
                                    </th>
                                    <th className="text-left p-2.5 border-b">
                                        Customer
                                    </th>
                                    <th className="text-left p-2.5 border-b">
                                        Town
                                    </th>
                                    <th className="text-right p-2.5 border-b">
                                        Amount
                                    </th>
                                    <th className="text-left p-2.5 border-b">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentSales.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="border-b last:border-0 hover:bg-gray-50"
                                    >
                                        <td className="p-2.5">
                                            <Link
                                                to={`/invoice/${inv.id}`}
                                                className="font-semibold text-brand-700 hover:underline"
                                            >
                                                #{inv.invoiceNo}
                                            </Link>
                                        </td>
                                        <td className="p-2.5 text-gray-600 whitespace-nowrap">
                                            {formatDateTime(inv.date)}
                                        </td>
                                        <td className="p-2.5 font-medium">
                                            {inv.customerName}
                                        </td>
                                        <td className="p-2.5 text-gray-600">
                                            {inv.townName || '—'}
                                        </td>
                                        <td className="p-2.5 text-right tabular-nums font-semibold">
                                            {money(inv.totalAmount)}
                                        </td>
                                        <td className="p-2.5">
                                            <PaymentBadge
                                                status={inv.paymentStatus}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
