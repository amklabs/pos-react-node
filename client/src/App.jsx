import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';

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
import StockReturn from './pages/StockReturn';
import PurchaseLookup from './pages/PurchaseLookup';
import InvoiceView from './pages/InvoiceView';
import CustomerLedger from './pages/CustomerLedger';
import Login from "./pages/Login.jsx";

import { AuthProvider, useAuthContext } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import usePageTitle from "./hooks/usePageTitle.js";

function AppLayout() {
    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <div className="flex-1 overflow-y-auto p-8">
                <Outlet />
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
                    <Route path="/purchase" element={<NewPurchase />} />
                    <Route path="/cash" element={<CashReceived />} />
                    <Route path="/invoice-lookup" element={<InvoiceLookup />} />
                    <Route path="/master-data" element={<MasterData />} />
                    <Route path="/reports/sales" element={<SalesReport />} />
                    <Route path="/reports/stock" element={<StockReport />} />
                    <Route path="/reports/cash" element={<CashSummary />} />
                    <Route path="/return" element={<StockReturn />} />
                    <Route path="/purchase-lookup" element={<PurchaseLookup />} />
                    <Route path="/invoice/:id" element={<InvoiceView />} />
                    <Route path="/ledger" element={<CustomerLedger />} />
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
                <AppRoutes />
            </AuthProvider>
        </Router>
    );
}

export default App;