// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
    return (
        <Router>
            <div className="flex h-screen bg-gray-100">
                <Sidebar />
                <div className="flex-1 overflow-y-auto p-8">
                    <Routes>
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
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;