import {NavLink, useNavigate} from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import {
    LayoutDashboard,
    ShoppingCart,
    ShoppingBag,
    Wallet,
    Search,
    Database,
    BarChart3,
    Package,
    Receipt,
    RotateCcw,
    Store,
    CircleUserRound,
    ChevronRight,
    BookOpen,
    LogOut
} from 'lucide-react';

export default function Sidebar() {
    const { user, logout } = useAuthContext();
    const navigate = useNavigate();
    const navLinkClass = ({isActive}) =>
        `group flex w-full items-center justify-start text-left gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`;

    const sections = [
        {
            title: 'Main Menu',
            items: [
                {name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true}
            ]
        },
        {
            title: 'Transactions',
            items: [
                {name: 'New Sale', path: '/sale', icon: ShoppingCart},
                {name: 'New Purchase', path: '/purchase', icon: ShoppingBag},
                {name: 'Cash Received', path: '/cash', icon: Wallet}
            ]
        },
        {
            title: 'Management',
            items: [
                {name: 'Invoice Lookup', path: '/invoice-lookup', icon: Search},
                {name: 'Purchase Lookup', path: '/purchase-lookup', icon: Search},
                {name: 'Master Data', path: '/master-data', icon: Database}
            ]
        },
        {
            title: 'Reports & Analytics',
            items: [
                {name: 'Sales Report', path: '/reports/sales', icon: BarChart3},
                {name: 'Stock Report', path: '/reports/stock', icon: Package},
                {name: 'Cash Summary', path: '/reports/cash', icon: Receipt},
                {name: 'Customer Ledger', path: '/ledger', icon: BookOpen}
            ]
        },
        {
            title: 'Inventory',
            items: [
                {name: 'Stock Return', path: '/return', icon: RotateCcw}
            ]
        }
    ];

    const handleLogout = () => {
        console.log('Logout');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login');
    }
    return (
        <aside className="w-64 min-w-64 bg-slate-950 text-white flex flex-col h-full shadow-xl print:hidden">

            {/* Brand Header */}
            <div className="px-5 py-2 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div
                        className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <Store size={23} className="text-white"/>
                    </div>

                    <div>
                        <span className="text-xl font-extrabold tracking-wide text-white mb-0">
                            POINT OF SALE
                        </span>
                        <p className="text-[10px] font-semibold tracking-[2px] text-blue-400 uppercase">
                            By AMK Labs
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-2 text-left">

                {sections.map((section) => (
                    <div key={section.title}>

                        <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-slate-500">
                            {section.title}
                        </h3>

                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end={item.end}
                                        className={navLinkClass}
                                    >
                                        <Icon
                                            size={18}
                                            strokeWidth={1.8}
                                            className="shrink-0"
                                        />

                                        <span className="flex-1">
                                            {item.name}
                                        </span>

                                        <ChevronRight
                                            size={15}
                                            className="opacity-0 group-hover:opacity-60 transition-opacity"
                                        />
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}

            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
                        <CircleUserRound size={17} className="text-blue-400"/>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-200">
                            {user?.firstname} {user?.lastname}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {user?.role?.name}
                        </p>
                    </div>

                    <div className="ml-auto">
                        <button className="hover:cursor-pointer hover:text-gray-500"
                                onClick={handleLogout}>
                            <LogOut size={18}/>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
