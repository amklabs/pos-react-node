// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Dashboard() {
    const [stats, setStats] = useState({
        todaySales: 0,
        totalCash: 0,
        totalProducts: 0,
        lowStockItems: []
    });
    const [loading, setLoading] = useState(true);
    const fetchDashboard = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/dashboard`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard().then(r => {
            console.log(r.data);
        });
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center min-h-[90vh] p-5">
            <div className="font-semibold text-gray-500 flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>Loading Dashboard...
            </div>
        </div>;
    }

    return (
        <div className="max-w-6xl">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Business Overview</h1>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                {/* Today's Sales */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500 flex flex-col justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Today's Sales</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">Rs. {stats.todaySales.toLocaleString()}</p>
                    </div>
                    <Link to="/reports/sales" className="text-blue-600 text-sm mt-4 hover:underline">View Report &rarr;</Link>
                </div>

                {/* Total Cash In Hand */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500 flex flex-col justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Cash In Hand</p>
                        <p className={`text-3xl font-bold mt-2 ${stats.totalCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Rs. {stats.totalCash.toLocaleString()}
                        </p>
                    </div>
                    <Link to="/reports/cash" className="text-green-600 text-sm mt-4 hover:underline">View Cash Summary &rarr;</Link>
                </div>

                {/* Total Products */}
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500 flex flex-col justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Products in System</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalProducts}</p>
                    </div>
                    <Link to="/master-data" className="text-purple-600 text-sm mt-4 hover:underline">Add New Product &rarr;</Link>
                </div>
            </div>

            {/* Bottom Section: Quick Actions & Low Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-lg shadow border-t-4 border-yellow-500">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/sale" className="bg-blue-50 text-blue-700 p-4 rounded text-center font-bold hover:bg-blue-100 transition border border-blue-200">
                            + New Sale
                        </Link>
                        <Link to="/purchase" className="bg-indigo-50 text-indigo-700 p-4 rounded text-center font-bold hover:bg-indigo-100 transition border border-indigo-200">
                            + New Purchase
                        </Link>
                        <Link to="/cash" className="bg-green-50 text-green-700 p-4 rounded text-center font-bold hover:bg-green-100 transition border border-green-200">
                            Receive Cash
                        </Link>
                        <Link to="/return" className="bg-red-50 text-red-700 p-4 rounded text-center font-bold hover:bg-red-100 transition border border-red-200">
                            Process Return
                        </Link>
                    </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-white p-6 rounded-lg shadow border-t-4 border-red-500">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Low Stock Alerts</h2>
                        <Link to="/reports/stock" className="text-sm text-blue-600 hover:underline">Full Stock Report</Link>
                    </div>

                    {stats.lowStockItems.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">
                            <p>All products have healthy stock levels! 🎉</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {stats.lowStockItems.map((item, idx) => (
                                <li key={idx} className="py-3 flex justify-between items-center">
                                    <span className="font-medium text-gray-700">{item.name}</span>
                                    <span className="bg-red-100 text-red-700 py-1 px-3 rounded-full text-sm font-bold">
                    {item.balance} left
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            </div>
        </div>
    );
}