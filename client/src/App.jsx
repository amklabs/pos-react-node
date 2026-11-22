import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewSale from './pages/NewSale';
import NewPurchase from './pages/NewPurchase';
import MasterData from './pages/MasterData';
import CashReceived from './pages/CashReceived';
import InvoiceLookup from './pages/InvoiceLookup';
import SalesReport from './pages/SalesReport';
import StockReport from './pages/StockReport';
import CashSummary from './pages/CashSummary';
import ProfitReport from './pages/ProfitReport';
import StockReturn from './pages/StockReturn';
import PurchaseLookup from './pages/PurchaseLookup';
import InvoiceView from './pages/InvoiceView';
import CustomerLedger from './pages/CustomerLedger';
import Users from './pages/Users';
import Login from "./pages/Login.jsx";

import { AuthProvider, useAuthContext } from './context/AuthContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import { ADMIN_ROLES, SUPER_ADMIN_ROLES } from './utils/roles';
import usePageTitle from "./hooks/usePageTitle.js";
import { STORE_NAME } from './constants/store.js';

function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    // Close mobile drawer on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Lock body scroll while mobile drawer is open
    useEffect(() => {
        if (!sidebarOpen) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [sidebarOpen]);

    return (
        <div className="flex h-dvh min-h-0 bg-gray-100 print:block print:h-auto print:bg-white">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <button
                    type="button"
                    className="fixed inset-0 z-30 bg-black/40 lg:hidden print:hidden"
                    aria-label="Close menu"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
                {/* Mobile top bar */}
                <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden print:hidden">
                    <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900 uppercase tracking-wide">
                            {STORE_NAME}
                        </p>
                        <p className="text-[11px] text-gray-500">Point of Sale</p>
                    </div>
                </header>

                <main className="page-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-8 print:p-0 print:overflow-visible">
                    <div className="mx-auto w-full min-w-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

// Redirect authenticated users away from /login
function PublicOnlyRoute() {
    const { user, loading } = useAuthContext();
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }
    return user ? <Navigate to="/" replace /> : <Outlet />;
}


function AppRoutes() {
    return (
        <Routes>
            {/* Public: only accessible when NOT logged in */}
            <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
            </Route>

            {/* Protected: requires auth, then renders inside sidebar layout */}
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sale" element={<NewSale />} />
                    <Route path="/cash" element={<CashReceived />} />
                    <Route path="/invoice-lookup" element={<InvoiceLookup />} />
                    <Route path="/reports/sales" element={<SalesReport />} />
                    <Route path="/reports/stock" element={<StockReport />} />
                    <Route path="/reports/cash" element={<CashSummary />} />
                    <Route path="/reports/profit" element={<ProfitReport />} />
                    <Route path="/return" element={<StockReturn />} />
                    <Route path="/purchase-lookup" element={<PurchaseLookup />} />
                    <Route path="/invoice/:id" element={<InvoiceView />} />
                    <Route path="/ledger" element={<CustomerLedger />} />

                    {/* Admin-only: master data + new purchase */}
                    <Route element={<RoleRoute roles={ADMIN_ROLES} />}>
                        <Route path="/purchase" element={<NewPurchase />} />
                        <Route path="/master-data" element={<MasterData />} />
                    </Route>

                    {/* Super Admin only: user management */}
                    <Route element={<RoleRoute roles={SUPER_ADMIN_ROLES} />}>
                        <Route path="/users" element={<Users />} />
                    </Route>
                </Route>
            </Route>
        </Routes>
    );
}

function App() {
    usePageTitle();

    return (
        <Router>
            <AuthProvider>
                <ConfirmDialogProvider>
                    <AppRoutes />
                </ConfirmDialogProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;