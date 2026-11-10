// src/pages/MasterData.jsx
import {useState, useEffect, useCallback} from 'react';
import apiClient from "../apiClient.js";
import usePageTitle from "../hooks/usePageTitle.js";
import {Check} from 'lucide-react';

const TABS = [
    {key: 'towns', label: 'Towns'},
    {key: 'salesmen', label: 'Salesmen'},
    {key: 'customers', label: 'Customers'},
    {key: 'companies', label: 'Companies'},
    {key: 'products', label: 'Products'},
];

export default function MasterData() {
    usePageTitle('Setup Data');

    const [activeTab, setActiveTab] = useState('towns');

    // Dropdown data (towns + companies) — shared across forms
    const [towns, setTowns] = useState([]);
    const [companies, setCompanies] = useState([]);

    // Per-entity list data
    const [lists, setLists] = useState({
        towns: [], salesmen: [], customers: [], companies: [], products: [],
    });

    // Loading / error per entity
    const [listLoading, setListLoading] = useState({});
    const [listError, setListError] = useState({});

    // ---- Fetch helpers ----
    const fetchList = useCallback(async (entity) => {
        setListLoading((s) => ({...s, [entity]: true}));
        setListError((s) => ({...s, [entity]: null}));
        try {
            const res = await apiClient.get(`/api/${entity}?showAll=true`);
            setLists((s) => ({...s, [entity]: res.data}));
        } catch (err) {
            console.error(`Error fetching ${entity}`, err);
            setListError((s) => ({...s, [entity]: err.message || 'Failed to load'}));
        } finally {
            setListLoading((s) => ({...s, [entity]: false}));
        }
    }, []);

    const refreshDropdowns = useCallback(async () => {
        try {
            const [townRes, compRes] = await Promise.all([
                apiClient.get(`/api/towns`),
                apiClient.get(`/api/companies`),
            ]);
            setTowns(townRes.data);
            setCompanies(compRes.data);
        } catch (err) {
            console.error('Error fetching dropdown data', err);
        }
    }, []);

    // Load everything on mount
    useEffect(() => {
        refreshDropdowns();
        TABS.forEach((t) => fetchList(t.key));
    }, [fetchList, refreshDropdowns]);

    // After adding/updating/deleting a town or company, refresh dropdowns + that list
    const refreshAfterMutation = (entity) => {
        fetchList(entity);
        if (entity === 'towns' || entity === 'companies') {
            refreshDropdowns();
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Master Data Setup</h1>

            {/* Tabs */}
            <div className="flex gap-1 border-b mb-6">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-t ${
                            activeTab === t.key
                                ? 'bg-white border border-b-white -mb-px text-blue-600 '
                                : 'text-gray-600 cursor-pointer hover:bg-white hover:text-blue-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="bg-white p-6 rounded shadow">
                {activeTab === 'towns' && (
                    <TownTab
                        towns={towns}
                        list={lists.towns}
                        loading={listLoading.towns}
                        error={listError.towns}
                        onMutated={() => refreshAfterMutation('towns')}
                    />
                )}
                {activeTab === 'salesmen' && (
                    <SalesmanTab
                        list={lists.salesmen}
                        loading={listLoading.salesmen}
                        error={listError.salesmen}
                        onMutated={() => refreshAfterMutation('salesmen')}
                    />
                )}
                {activeTab === 'customers' && (
                    <CustomerTab
                        towns={towns}
                        list={lists.customers}
                        loading={listLoading.customers}
                        error={listError.customers}
                        onMutated={() => refreshAfterMutation('customers')}
                    />
                )}
                {activeTab === 'companies' && (
                    <CompanyTab
                        list={lists.companies}
                        loading={listLoading.companies}
                        error={listError.companies}
                        onMutated={() => refreshAfterMutation('companies')}
                    />
                )}
                {activeTab === 'products' && (
                    <ProductTab
                        companies={companies}
                        list={lists.products}
                        loading={listLoading.products}
                        error={listError.products}
                        onMutated={() => refreshAfterMutation('products')}
                    />
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Generic form + table shell                                          */

/* ------------------------------------------------------------------ */

function EntitySection({title, form, list, loading, error, renderRow, columns}) {
    return (
        <div className="space-y-6">
            {/* Form */}
            <div>
                <h2 className="text-lg font-semibold mb-3 border-b pb-2">{title}</h2>
                {form}
            </div>

            {/* List */}
            <div>
                <h3 className="text-md font-semibold mb-2">Existing</h3>
                {loading && <p className="text-sm text-gray-500">Loading…</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border">
                            <thead className="bg-gray-50">
                            <tr>
                                {columns.map((c) => (
                                    <th key={c.key} className="text-left p-2 border-b">{c.label}</th>
                                ))}
                                <th className="text-right p-2 border-b">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {list.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 1} className="p-3 text-center text-gray-500">
                                        No records yet.
                                    </td>
                                </tr>
                            )}
                            {list.map((row) => renderRow(row))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Towns                                                               */

/* ------------------------------------------------------------------ */

function TownTab({towns, list, loading, error, onMutated}) {
    const empty = {id: null, name: ''};
    const [form, setForm] = useState(empty);
    const isEditing = form.id != null;
    const [processing, setProcessing] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        try {
            setProcessing(true);
            if (isEditing) {
                await apiClient.put(`/api/towns/${form.id}`, {
                    name: form.name,
                    isActive: form.isActive
                });
            } else {
                await apiClient.post(`/api/towns`, {name: form.name, isActive: form.isActive});
            }
            setForm(empty);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error saving town');
        } finally {
            setProcessing(false);
        }
    };

    const onDelete = async (row) => {
        if (!confirm(`Delete town "${row.name}"?`)) return;
        try {
            await apiClient.delete(`/api/towns/${row.id}`);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error deleting town');
        }
    };

    return (
        <EntitySection
            title={isEditing ? `Edit Town #${form.id}` : 'Add Town'}
            loading={loading}
            error={error}
            list={list}
            columns={[{key: 'name', label: 'Name'}, {key: 'isActive', label: 'Active'}]}
            form={
                <form onSubmit={submit} className="flex gap-2">
                    <input
                        id="townName"
                        type="text"
                        placeholder="Town Name"
                        className="border p-2 rounded w-75"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        required
                    />
                    <div>
                        <label htmlFor="townActive" className="flex items-center gap-4 mt-2">
                            <input type="checkbox" id="townActive"
                                   value={form.isActive}
                                   checked={form.isActive}
                                   onChange={(e) => setForm({...form, isActive: e.target.checked})}/>
                            <span>Active</span>
                        </label>
                    </div>
                    <button className="btn btn-primary disabled:bg-blue-300 " disabled={processing}>
                        {isEditing ? 'Update' : 'Add'}
                    </button>
                    {isEditing && (
                        <button
                            disabled={processing}
                            type="button"
                            onClick={() => setForm(empty)}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    )}
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className="border-b">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">
                        {row.isActive && (
                            <Check/>
                        )}
                    </td>
                    <td className="p-2 text-right space-x-2">
                        <button
                            onClick={() => setForm({id: row.id, name: row.name, isActive: row.isActive})}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(row)}
                            className="text-red-600 hover:underline text-sm"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ------------------------------------------------------------------ */
/* Salesmen                                                            */

/* ------------------------------------------------------------------ */

function SalesmanTab({list, loading, error, onMutated}) {
    const empty = {id: null, name: '', phone: ''};
    const [form, setForm] = useState(empty);
    const isEditing = form.id != null;
    const [processing, setProcessing] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        try {
            setProcessing(true);
            if (isEditing) {
                await apiClient.put(`/api/salesmen/${form.id}`, {
                    name: form.name, phone: form.phone,
                });
            } else {
                await apiClient.post(`/api/salesmen`, {
                    name: form.name, phone: form.phone,
                });
            }
            setForm(empty);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error saving salesman');
        } finally {
            setProcessing(false);
        }
    };

    const onDelete = async (row) => {
        if (!confirm(`Delete salesman "${row.name}"?`)) return;
        try {
            await apiClient.delete(`/api/salesmen/${row.id}`);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error deleting salesman');
        }
    };

    return (
        <EntitySection
            title={isEditing ? `Edit Salesman #${form.id}` : 'Add Salesman'}
            loading={loading}
            error={error}
            list={list}
            columns={[
                {key: 'name', label: 'Name'},
                {key: 'phone', label: 'Phone'},
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        className="border p-2 rounded"
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        required
                    />
                    <input
                        className="border p-2 rounded"
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                    />
                    <div className="flex gap-2">
                        <button className="btn btn-primary disabled:bg-blue-300" disabled={processing}>
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button type="button" onClick={() => setForm(empty)} className="btn btn-secondary">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className="border-b">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.phone || '-'}</td>
                    <td className="p-2 text-right space-x-2">
                        <button
                            onClick={() => setForm({id: row.id, name: row.name, phone: row.phone || ''})}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Edit
                        </button>
                        <button onClick={() => onDelete(row)} className="text-red-600 hover:underline text-sm">
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */

/* ------------------------------------------------------------------ */

function CustomerTab({towns, list, loading, error, onMutated}) {
    const empty = {id: null, name: '', phone: '', townId: ''};
    const [form, setForm] = useState(empty);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: form.name,
                phone: form.phone,
                townId: form.townId ? Number(form.townId) : null,
            };
            if (isEditing) {
                await apiClient.put(`/api/customers/${form.id}`, payload);
            } else {
                await apiClient.post(`/api/customers`, payload);
            }
            setForm(empty);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error saving customer');
        }
    };

    const onDelete = async (row) => {
        if (!confirm(`Delete customer "${row.name}"?`)) return;
        try {
            await apiClient.delete(`/api/customers/${row.id}`);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error deleting customer');
        }
    };

    return (
        <EntitySection
            title={isEditing ? `Edit Customer #${form.id}` : 'Add Customer'}
            loading={loading}
            error={error}
            list={list}
            columns={[
                {key: 'name', label: 'Name'},
                {key: 'phone', label: 'Phone'},
                {key: 'town', label: 'Town'},
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                        className="border p-2 rounded"
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        required
                    />
                    <input
                        className="border p-2 rounded"
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                    />
                    <select
                        className="border p-2 rounded"
                        value={form.townId}
                        onChange={(e) => setForm({...form, townId: e.target.value})}
                    >
                        <option value="">Select Town</option>
                        {towns.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button className="btn btn-primary">
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button type="button" onClick={() => setForm(empty)} className="px-4 py-2 rounded border">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className="border-b">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.phone || '-'}</td>
                    <td className="p-2">{row.town?.name || '-'}</td>
                    <td className="p-2 text-right space-x-2">
                        <button
                            onClick={() => setForm({
                                id: row.id, name: row.name,
                                phone: row.phone || '', townId: row.townId || '',
                            })}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Edit
                        </button>
                        <button onClick={() => onDelete(row)} className="text-red-600 hover:underline text-sm">
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ------------------------------------------------------------------ */
/* Companies                                                           */

/* ------------------------------------------------------------------ */

function CompanyTab({list, loading, error, onMutated}) {
    const empty = {id: null, name: '', phone: ''};
    const [form, setForm] = useState(empty);
    const isEditing = form.id != null;
    const [processing, setProcessing] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        try {
            setProcessing(true);
            if (isEditing) {
                await apiClient.put(`/api/companies/${form.id}`, {
                    name: form.name, phone: form.phone,
                });
            } else {
                await apiClient.post(`/api/companies`, {
                    name: form.name, phone: form.phone,
                });
            }
            setForm(empty);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error saving company');
        } finally {
            setProcessing(false);
        }
    };

    const onDelete = async (row) => {
        if (!confirm(`Delete company "${row.name}"?`)) return;
        try {
            await apiClient.delete(`/api/companies/${row.id}`);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error deleting company');
        }
    };

    return (
        <EntitySection
            title={isEditing ? `Edit Company #${form.id}` : 'Add Company / Supplier'}
            loading={loading}
            error={error}
            list={list}
            columns={[
                {key: 'name', label: 'Name'},
                {key: 'phone', label: 'Phone'},
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        className="form-input"
                        placeholder="Company Name"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        required
                    />
                    <input
                        className="form-input"
                        placeholder="Phone"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                    />
                    <div className="flex gap-2">
                        <button className="btn btn-primary disabled:bg-blue-300" disabled={processing}>
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button type="button" onClick={() => setForm(empty)} className="px-4 py-2 rounded border">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className="border-b">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.phone || '-'}</td>
                    <td className="p-2 text-right space-x-2">
                        <button
                            onClick={() => setForm({id: row.id, name: row.name, phone: row.phone || ''})}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Edit
                        </button>
                        <button onClick={() => onDelete(row)} className="text-red-600 hover:underline text-sm">
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */

/* ------------------------------------------------------------------ */

function ProductTab({companies, list, loading, error, onMutated}) {
    const empty = {id: null, name: '', companyId: ''};
    const [form, setForm] = useState(empty);
    const isEditing = form.id != null;
    const [processing, setProcessing] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        try {
            setProcessing(true);
            const payload = {
                name: form.name,
                companyId: form.companyId ? Number(form.companyId) : null,
                isActive: form.isActive,
            };
            if (isEditing) {
                await apiClient.put(`/api/products/${form.id}`, payload);
            } else {
                await apiClient.post(`/api/products`, payload);
            }
            setForm(empty);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error saving product');
        }finally {
            setProcessing(false);
        }
    };

    const onDelete = async (row) => {
        if (!confirm(`Delete product "${row.name}"?`)) return;
        try {
            await apiClient.delete(`/api/products/${row.id}`);
            onMutated();
        } catch (err) {
            console.error(err);
            alert('Error deleting product');
        }
    };

    return (
        <EntitySection
            title={isEditing ? `Edit Product #${form.id}` : 'Add Product'}
            loading={loading}
            error={error}
            list={list}
            columns={[
                {key: 'name', label: 'Product'},
                {key: 'company', label: 'Company'},
                {key: 'isActive', label: 'Active'},
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                        className="form-input"
                        placeholder="Product Name"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        required
                    />
                    <select
                        className="form-select"
                        value={form.companyId}
                        onChange={(e) => setForm({...form, companyId: e.target.value})}
                    >
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <label htmlFor="townActive" className="flex items-center gap-4 mt-2">
                        <input type="checkbox" id="townActive"
                               value={form.isActive}
                               checked={form.isActive}
                               onChange={(e) => setForm({...form, isActive: e.target.checked})}/>
                        <span>Active</span>
                    </label>
                    <div className="flex gap-2">
                        <button className="btn btn-primary disabled:bg-blue-300" disabled={processing}>
                            {isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button type="button" onClick={() => setForm(empty)} className="px-4 py-2 rounded border">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className="border-b">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.company?.name || '-'}</td>
                    <td className="p-2">{row.isActive && (
                        <Check/>
                    )}</td>
                    <td className="p-2 text-right space-x-2">
                        <button
                            onClick={() => setForm({
                                id: row.id, name: row.name,
                                companyId: row.companyId || '',
                                isActive: row.isActive,
                            })}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Edit
                        </button>
                        <button onClick={() => onDelete(row)} className="text-red-600 hover:underline text-sm">
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}