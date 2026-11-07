// src/pages/MasterData.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

import apiClient from "../apiClient.js";
import usePageTitle from "../hooks/usePageTitle.js";

export default function MasterData() {
    usePageTitle('Setup Data');
    const [townName, setTownName] = useState('');
    const [customer, setCustomer] = useState({ name: '', phone: '', townId: '' });
    const [salesman, setSalesman] = useState({ name: '', phone: '' });
    const [company, setCompany] = useState({ name: '', phone: '' });
    const [product, setProduct] = useState({ name: '', companyId: '' });

    // Dropdown data states
    const [towns, setTowns] = useState([]);
    const [companies, setCompanies] = useState([]);

    // Fetch towns and companies so we can populate the dropdowns
    const fetchDropdownData = async () => {
        try {
            const [townRes, compRes] = await Promise.all([
                apiClient.get(`/api/towns`),
                apiClient.get(`/api/companies`)
            ]);
            setTowns(townRes.data);
            setCompanies(compRes.data);
        } catch (err) {
            console.error("Error fetching dropdown data", err);
        }
    };

    useEffect(() => {
        fetchDropdownData().then(r => {});
    }, []);

    // Generic handler to reduce code repetition
    const handleAdd = async (endpoint, data, setter, emptyState) => {
        try {
            await apiClient.post(`/api/${endpoint}`, data);
            alert('Added Successfully!');
            setter(emptyState);

            // If we added a Town or Company, we need to refresh the dropdowns
            if (endpoint === 'towns' || endpoint === 'companies') {
                fetchDropdownData().then(r => {});
            }
        } catch (err) {
            alert('Error adding. Check console.');
            console.error(err);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Master Data Setup</h1>

            <div className="grid grid-cols-2 gap-6">

                {/* Add Town */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-2">Add Town</h2>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Town Name" className="border p-2 rounded flex-1" value={townName} onChange={(e) => setTownName(e.target.value)} />
                        <button onClick={() => handleAdd('towns', {name: townName}, setTownName, '')} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
                    </div>
                </div>

                {/* Add Salesman */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-2">Add Salesman</h2>
                    <div className="flex flex-col gap-2">
                        <input type="text" placeholder="Name" className="border p-2 rounded" value={salesman.name} onChange={(e) => setSalesman({...salesman, name: e.target.value})} />
                        <input type="text" placeholder="Phone" className="border p-2 rounded" value={salesman.phone} onChange={(e) => setSalesman({...salesman, phone: e.target.value})} />
                        <button onClick={() => handleAdd('salesmen', salesman, setSalesman, {name:'', phone:''})} className="bg-green-600 text-white px-4 py-2 rounded">Add Salesman</button>
                    </div>
                </div>

                {/* Add Customer */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-2">Add Customer</h2>
                    <div className="flex flex-col gap-2">
                        <input type="text" placeholder="Name" className="border p-2 rounded" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} />
                        <input type="text" placeholder="Phone" className="border p-2 rounded" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} />

                        {/* Town Dropdown */}
                        <select
                            className="border p-2 rounded"
                            value={customer.townId}
                            onChange={(e) => setCustomer({...customer, townId: e.target.value})}
                        >
                            <option value="">Select Town</option>
                            {towns.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <button onClick={() => handleAdd('customers', customer, setCustomer, {name:'', phone:'', townId:''})} className="bg-green-600 text-white px-4 py-2 rounded">Add Customer</button>
                    </div>
                </div>

                {/* Add Company (Supplier) */}
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-2">Add Company / Supplier</h2>
                    <div className="flex flex-col gap-2">
                        <input type="text" placeholder="Company Name" className="border p-2 rounded" value={company.name} onChange={(e) => setCompany({...company, name: e.target.value})} />
                        <input type="text" placeholder="Phone" className="border p-2 rounded" value={company.phone} onChange={(e) => setCompany({...company, phone: e.target.value})} />
                        <button onClick={() => handleAdd('companies', company, setCompany, {name:'', phone:''})} className="bg-purple-600 text-white px-4 py-2 rounded">Add Company</button>
                    </div>
                </div>

                {/* Add Product */}
                <div className="bg-white p-4 rounded shadow col-span-2">
                    <h2 className="text-lg font-semibold mb-3 border-b pb-2">Add Product</h2>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Product Name" className="border p-2 rounded flex-1" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})} />

                        {/* Company Dropdown */}
                        <select
                            className="border p-2 rounded w-64"
                            value={product.companyId}
                            onChange={(e) => setProduct({...product, companyId: e.target.value})}
                        >
                            <option value="">Select Company</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <button onClick={() => handleAdd('products', product, setProduct, {name:'', companyId:''})} className="bg-orange-600 text-white px-6 py-2 rounded">Add Product</button>
                    </div>
                </div>

            </div>
        </div>
    );
}