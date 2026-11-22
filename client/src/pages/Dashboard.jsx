// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ShoppingCart,
    ShoppingBag,
    Wallet,
    RotateCcw,
    Search,
    BookOpen,
    RefreshCw,
    TrendingUp,
    Banknote,
    AlertTriangle,
    CircleDollarSign,
    Package,
    ArrowDownLeft,
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

const STAT_THEMES = {
    blue: {
        card: 'from-sky-50 via-white to-white border-sky-100 shadow-sky-100/60',
        bar: 'from-sky-500 to-blue-600',
        icon: 'bg-sky-500 text-white shadow-sky-500/35',
        label: 'text-sky-700',
        value: 'text-slate-900',
        link: 'text-sky-700 hover:text-sky-900',
        glow: 'bg-sky-400/20',
    },
    emerald: {
        card: 'from-emerald-50 via-white to-white border-emerald-100 shadow-emerald-100/60',
        bar: 'from-emerald-500 to-teal-600',
        icon: 'bg-emerald-500 text-white shadow-emerald-500/35',
        label: 'text-emerald-700',
        value: 'text-slate-900',
        link: 'text-emerald-700 hover:text-emerald-900',
        glow: 'bg-emerald-400/20',
    },
    teal: {
        card: 'from-teal-50 via-white to-white border-teal-100 shadow-teal-100/60',
        bar: 'from-teal-500 to-cyan-600',
        icon: 'bg-teal-500 text-white shadow-teal-500/35',
        label: 'text-teal-700',
        value: 'text-slate-900',
        link: 'text-teal-700 hover:text-teal-900',
        glow: 'bg-teal-400/20',
    },
    amber: {
        card: 'from-amber-50 via-white to-white border-amber-100 shadow-amber-100/60',
        bar: 'from-amber-500 to-orange-500',
        icon: 'bg-amber-500 text-white shadow-amber-500/35',
        label: 'text-amber-800',
        value: 'text-slate-900',
        link: 'text-amber-700 hover:text-amber-900',
        glow: 'bg-amber-400/25',
    },
    rose: {
        card: 'from-rose-50 via-white to-white border-rose-100 shadow-rose-100/60',
        bar: 'from-rose-500 to-red-600',
        icon: 'bg-rose-500 text-white shadow-rose-500/35',
        label: 'text-rose-700',
        value: 'text-slate-900',
        link: 'text-rose-700 hover:text-rose-900',
        glow: 'bg-rose-400/20',
    },
    slate: {
        card: 'from-slate-50 via-white to-white border-slate-200 shadow-slate-100/60',
        bar: 'from-slate-500 to-slate-700',
        icon: 'bg-slate-700 text-white shadow-slate-500/30',
        label: 'text-slate-600',
        value: 'text-slate-900',
        link: 'text-slate-700 hover:text-slate-900',
        glow: 'bg-slate-400/15',
    },
};

function StatCard({ label, value, hint, to, linkLabel, theme = 'blue', icon: Icon }) {
    const t = STAT_THEMES[theme] || STAT_THEMES.blue;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border bg-linear-to-br ${t.card} p-5 shadow-md flex flex-col justify-between min-h-37 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
        >
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl ${t.glow}`} />
            <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${t.bar}`} />

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${t.label}`}>
                        {label}
                    </p>
                    <p className={`text-2xl sm:text-[1.75rem] font-extrabold mt-2.5 tabular-nums break-all tracking-tight ${t.value}`}>
                        {value}
                    </p>
                    {hint ? (
                        <p className="text-xs text-slate-500 mt-1.5 leading-snug">{hint}</p>
                    ) : null}
                </div>
                {Icon ? (
                    <div
                        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${t.icon}`}
                    >
                        <Icon size={20} strokeWidth={2.25} />
                    </div>
                ) : null}
            </div>

            {to ? (
                <Link
                    to={to}
                    className={`relative text-sm mt-4 font-semibold w-fit inline-flex items-center gap-1 transition-colors ${t.link}`}
                >
                    {linkLabel || 'View details'}
                    <span aria-hidden>→</span>
                </Link>
            ) : (
                <span className="mt-4 h-5" />
            )}
        </div>
    );
}

function MiniStat({ label, value, theme = 'slate', icon: Icon, to }) {
    const t = STAT_THEMES[theme] || STAT_THEMES.slate;
    const inner = (
        <>
            <div className="flex items-center gap-2.5 min-w-0">
                {Icon ? (
                    <div
                        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-md ${t.icon}`}
                    >
                        <Icon size={16} strokeWidth={2.25} />
                    </div>
                ) : null}
                <span className={`text-xs font-bold uppercase tracking-wide truncate ${t.label}`}>
                    {label}
                </span>
            </div>
            <span className={`font-extrabold tabular-nums text-sm sm:text-base ${t.value}`}>
                {value}
            </span>
        </>
    );

    const className = `relative overflow-hidden rounded-xl border bg-gradient-to-br ${t.card} px-3.5 py-3.5 flex items-center justify-between gap-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`;

    if (to) {
        return (
            <Link to={to} className={className}>
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${t.bar}`} />
                {inner}
            </Link>
        );
    }

    return (
        <div className={className}>
            <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${t.bar}`} />
            {inner}
        </div>
    );
}

function ActionLink({ to, icon: Icon, label, className, iconClass }) {
    return (
        <Link
            to={to}
            className={`group flex items-center gap-3 p-3.5 rounded-xl font-semibold text-sm transition-all border shadow-sm hover:-translate-y-0.5 hover:shadow-md ${className}`}
        >
            <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-sm ${iconClass}`}
            >
                <Icon size={17} strokeWidth={2.25} />
            </span>
            <span className="flex-1">{label}</span>
            <span className="opacity-0 group-hover:opacity-70 transition-opacity text-current">
                →
            </span>
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
        <div className="w-full min-w-0 space-y-6">
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
                    theme="blue"
                    icon={TrendingUp}
                />
                <StatCard
                    label="Today's Profit"
                    value={money(stats.todayProfit)}
                    hint="Sales profit minus returns"
                    to="/reports/profit"
                    linkLabel="Profit report"
                    theme={Number(stats.todayProfit) >= 0 ? 'emerald' : 'rose'}
                    icon={CircleDollarSign}
                />
                <StatCard
                    label="Cash in Hand"
                    value={money(stats.totalCash)}
                    hint={`Received today: ${money(stats.todayCashReceived)}`}
                    to="/reports/cash"
                    linkLabel="Cash summary"
                    theme={Number(stats.totalCash) >= 0 ? 'teal' : 'rose'}
                    icon={Banknote}
                />
                <StatCard
                    label="Outstanding"
                    value={money(stats.outstandingReceivables)}
                    hint={`${stats.unpaidInvoiceCount || 0} unpaid sale${stats.unpaidInvoiceCount === 1 ? '' : 's'}`}
                    to="/ledger"
                    linkLabel="Customer ledger"
                    theme="amber"
                    icon={CircleDollarSign}
                />
            </div>

            {/* Secondary today strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MiniStat
                    label="Purchases"
                    value={money(stats.todayPurchases)}
                    theme="slate"
                    icon={ShoppingBag}
                    to={admin ? '/purchase-lookup' : undefined}
                />
                <MiniStat
                    label="Returns"
                    value={money(stats.todayReturns)}
                    theme="rose"
                    icon={RotateCcw}
                    to="/return"
                />
                <MiniStat
                    label="Cash in"
                    value={money(stats.todayCashReceived)}
                    theme="emerald"
                    icon={ArrowDownLeft}
                    to="/cash"
                />
                <MiniStat
                    label="Products"
                    value={formatNumber(stats.totalProducts, {
                        maximumFractionDigits: 0,
                    })}
                    theme="blue"
                    icon={Package}
                    to="/reports/stock"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Quick actions */}
                <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-white p-5 rounded-2xl shadow-md border border-sky-100">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
                    <h2 className="text-lg font-bold text-slate-900 mb-4">
                        Quick actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                        <ActionLink
                            to="/sale"
                            icon={ShoppingCart}
                            label="New sale"
                            className="bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100"
                            iconClass="bg-sky-500 text-white"
                        />
                        {admin && (
                            <ActionLink
                                to="/purchase"
                                icon={ShoppingBag}
                                label="New purchase"
                                className="bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100"
                                iconClass="bg-slate-700 text-white"
                            />
                        )}
                        <ActionLink
                            to="/cash"
                            icon={Wallet}
                            label="Receive cash"
                            className="bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                            iconClass="bg-emerald-500 text-white"
                        />
                        <ActionLink
                            to="/return"
                            icon={RotateCcw}
                            label="Stock return"
                            className="bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100"
                            iconClass="bg-rose-500 text-white"
                        />
                        <ActionLink
                            to="/invoice-lookup"
                            icon={Search}
                            label="Invoice lookup"
                            className="bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100"
                            iconClass="bg-teal-500 text-white"
                        />
                        <ActionLink
                            to="/ledger"
                            icon={BookOpen}
                            label="Customer ledger"
                            className="bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100"
                            iconClass="bg-amber-500 text-white"
                        />
                    </div>
                </div>

                {/* Low stock */}
                <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-white p-5 rounded-2xl shadow-md border border-rose-100 lg:col-span-2">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white shadow-md shadow-rose-500/30">
                                <AlertTriangle size={16} />
                            </span>
                            Low stock
                            <span className="text-sm font-normal text-slate-400">
                                (below {stats.lowStockThreshold || 10})
                            </span>
                        </h2>
                        <Link
                            to="/reports/stock"
                            className="text-sm text-rose-700 hover:text-rose-900 hover:underline font-semibold"
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
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-white p-5 rounded-2xl shadow-md border border-sky-100">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md shadow-sky-500/30">
                            <TrendingUp size={16} />
                        </span>
                        Recent sales
                    </h2>
                    <Link
                        to="/invoice-lookup"
                        className="text-sm text-sky-700 hover:text-sky-900 hover:underline font-semibold"
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
