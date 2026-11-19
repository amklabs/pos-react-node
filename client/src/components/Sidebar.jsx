import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { ADMIN_ROLES, SUPER_ADMIN_ROLES, hasRole } from '../utils/roles';
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
    LogOut,
    Users,
    X,
} from 'lucide-react';
import { STORE_NAME } from '../constants/store.js';

export default function Sidebar({ open = false, onClose }) {
    const { user, logout, loggingOut } = useAuthContext();
    const navLinkClass = ({ isActive }) =>
        `group flex w-full items-center justify-start text-left gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`;

    const sections = [
        {
            title: 'Main Menu',
            items: [
                { name: 'Dashboard', path: '/', icon: LayoutDashboard, end: true },
            ],
        },
        {
            title: 'Transactions',
            items: [
                { name: 'New Sale', path: '/sale', icon: ShoppingCart },
                { name: 'New Purchase', path: '/purchase', icon: ShoppingBag, roles: ADMIN_ROLES },
                { name: 'New Cash Entry', path: '/cash', icon: Wallet },
            ],
        },
        {
            title: 'Management',
            items: [
                { name: 'Invoice Lookup', path: '/invoice-lookup', icon: Search },
                { name: 'Purchase Lookup', path: '/purchase-lookup', icon: Search },
                { name: 'Master Data', path: '/master-data', icon: Database, roles: ADMIN_ROLES },
                { name: 'Users', path: '/users', icon: Users, roles: SUPER_ADMIN_ROLES },
            ],
        },
        {
            title: 'Reports & Analytics',
            items: [
                { name: 'Sales Report', path: '/reports/sales', icon: BarChart3 },
                { name: 'Stock Report', path: '/reports/stock', icon: Package },
                { name: 'Cash Summary', path: '/reports/cash', icon: Receipt },
                { name: 'Customer Ledger', path: '/ledger', icon: BookOpen },
            ],
        },
        {
            title: 'Inventory',
            items: [
                { name: 'Stock Return', path: '/return', icon: RotateCcw },
            ],
        },
    ];

    const visibleSections = sections
        .map((section) => ({
            ...section,
            items: section.items.filter(
                (item) => !item.roles || hasRole(user, item.roles)
            ),
        }))
        .filter((section) => section.items.length > 0);

    const handleLogout = () => {
        logout();
    };

    return (
        <aside
            className={`
                fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-slate-950 text-white flex flex-col
                shadow-xl print:hidden
                transform transition-transform duration-200 ease-out
                ${open ? 'translate-x-0' : '-translate-x-full'}
                lg:static lg:translate-x-0 lg:shrink-0 lg:max-w-none
            `}
        >
            {/* Brand Header */}
            <div className="px-5 py-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
                        <Store size={23} className="text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="block text-[11px] font-extrabold leading-snug tracking-wide text-white uppercase">
                            {STORE_NAME}
                        </span>
                        <p className="text-[10px] font-semibold tracking-[2px] text-blue-400 uppercase mt-0.5">
                            Point of Sale
                        </p>
                    </div>

                    <button
                        type="button"
                        className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={onClose}
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-scroll flex-1 px-3 py-5 overflow-y-auto space-y-2 text-left overscroll-contain">
                {visibleSections.map((section) => (
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
                                        onClick={onClose}
                                    >
                                        <Icon
                                            size={18}
                                            strokeWidth={1.8}
                                            className="shrink-0"
                                        />

                                        <span className="flex-1 min-w-0 truncate">
                                            {item.name}
                                        </span>

                                        <ChevronRight
                                            size={15}
                                            className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                                        />
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 shrink-0">
                <div className="flex items-center gap-3 px-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <CircleUserRound size={17} className="text-blue-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                            {user?.firstname} {user?.lastname}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                            {user?.role?.name}
                        </p>
                    </div>

                    <button
                        type="button"
                        aria-label={loggingOut ? 'Signing out' : 'Log out'}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-slate-800 hover:text-white text-slate-300 disabled:opacity-50 disabled:pointer-events-none"
                        onClick={handleLogout}
                        disabled={loggingOut}
                    >
                        {loggingOut ? (
                            <span
                                className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-slate-400 border-t-transparent"
                                aria-hidden
                            />
                        ) : (
                            <LogOut size={18} />
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
}
