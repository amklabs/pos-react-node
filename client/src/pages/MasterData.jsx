// src/pages/MasterData.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { toastSuccess, toastError } from '../utils/toast';

const TABS = [
    { key: 'towns', label: 'Towns', singular: 'Town' },
    { key: 'salesmen', label: 'Salesmen', singular: 'Salesman' },
    { key: 'customers', label: 'Customers', singular: 'Customer' },
    { key: 'companies', label: 'Companies', singular: 'Company' },
    { key: 'products', label: 'Products', singular: 'Product' },
];

export default function MasterData() {
    usePageTitle('Master Data');

    const [activeTab, setActiveTab] = useState('towns');
    const [towns, setTowns] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [lists, setLists] = useState({
        towns: [],
        salesmen: [],
        customers: [],
        companies: [],
        products: [],
    });
    const [listLoading, setListLoading] = useState({});
    const [listError, setListError] = useState({});

    const fetchList = useCallback(async (entity) => {
        setListLoading((s) => ({ ...s, [entity]: true }));
        setListError((s) => ({ ...s, [entity]: null }));
        try {
            const res = await apiClient.get(`/api/${entity}`, {
                params: { showAll: 'true' },
            });
            setLists((s) => ({ ...s, [entity]: res.data || [] }));
        } catch (err) {
            setListError((s) => ({
                ...s,
                [entity]: err.response?.data?.error || 'Failed to load',
            }));
        } finally {
            setListLoading((s) => ({ ...s, [entity]: false }));
        }
    }, []);

    const refreshDropdowns = useCallback(async () => {
        try {
            const [townRes, compRes] = await Promise.all([
                apiClient.get(`/api/towns`),
                apiClient.get(`/api/companies`),
            ]);
            setTowns(townRes.data || []);
            setCompanies(compRes.data || []);
        } catch {
            // dropdowns are best-effort
        }
    }, []);

    useEffect(() => {
        refreshDropdowns();
        TABS.forEach((t) => fetchList(t.key));
    }, [fetchList, refreshDropdowns]);

    const refreshAfterMutation = (entity) => {
        fetchList(entity);
        if (entity === 'towns' || entity === 'companies') {
            refreshDropdowns();
        }
    };

    const activeMeta = TABS.find((t) => t.key === activeTab);

    return (
        <div className="w-full min-w-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Master Data Setup</h1>
                <p className="text-sm text-gray-500">
                    Manage towns, parties, suppliers, and products used across sales and purchases.
                </p>
            </div>

            <div className="flex flex-wrap gap-1 border-b mb-6" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                            activeTab === t.key
                                ? 'border-blue-600 text-blue-700 bg-white'
                                : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-white/60'
                        }`}
                    >
                        {t.label}
                        <span className="ml-2 text-xs text-gray-400">
                            {lists[t.key]?.length ?? 0}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-lg border-t-4 border-blue-600">
                {activeTab === 'towns' && (
                    <TownTab
                        title={activeMeta.singular}
                        list={lists.towns}
                        loading={listLoading.towns}
                        error={listError.towns}
                        onMutated={() => refreshAfterMutation('towns')}
                    />
                )}
                {activeTab === 'salesmen' && (
                    <SalesmanTab
                        title={activeMeta.singular}
                        list={lists.salesmen}
                        loading={listLoading.salesmen}
                        error={listError.salesmen}
                        onMutated={() => refreshAfterMutation('salesmen')}
                    />
                )}
                {activeTab === 'customers' && (
                    <CustomerTab
                        title={activeMeta.singular}
                        towns={towns}
                        list={lists.customers}
                        loading={listLoading.customers}
                        error={listError.customers}
                        onMutated={() => refreshAfterMutation('customers')}
                    />
                )}
                {activeTab === 'companies' && (
                    <CompanyTab
                        title={activeMeta.singular}
                        list={lists.companies}
                        loading={listLoading.companies}
                        error={listError.companies}
                        onMutated={() => refreshAfterMutation('companies')}
                    />
                )}
                {activeTab === 'products' && (
                    <ProductTab
                        title={activeMeta.singular}
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

function StatusBadge({ active }) {
    return active ? (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
            Active
        </span>
    ) : (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600">
            Inactive
        </span>
    );
}

function ActiveToggle({ id, checked, onChange }) {
    return (
        <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer select-none h-10">
            <input
                type="checkbox"
                id={id}
                checked={Boolean(checked)}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span>Active</span>
        </label>
    );
}

function EntitySection({
    title,
    form,
    list,
    loading,
    error,
    columns,
    renderRow,
    searchKeys = ['name'],
}) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (list || []).filter((row) => {
            if (statusFilter === 'active' && row.isActive === false) return false;
            if (statusFilter === 'inactive' && row.isActive !== false) return false;
            if (!q) return true;
            return searchKeys.some((key) => {
                if (key === 'town') return row.town?.name?.toLowerCase().includes(q);
                if (key === 'company') return row.company?.name?.toLowerCase().includes(q);
                return String(row[key] ?? '')
                    .toLowerCase()
                    .includes(q);
            });
        });
    }, [list, search, statusFilter, searchKeys]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-3 border-b pb-2">{title}</h2>
                {form}
            </div>

            <div>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                    <h3 className="text-md font-semibold">
                        Existing{' '}
                        <span className="text-sm font-normal text-gray-500">
                            ({filtered.length}
                            {filtered.length !== list.length ? ` of ${list.length}` : ''})
                        </span>
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="search"
                            placeholder="Search..."
                            className="border p-2 rounded-input w-full sm:w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <select
                            className="border p-2 rounded-input"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {loading && (
                    <div className="py-8">
                        <Spinner size="md" label="Loading..." />
                    </div>
                )}
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                {!loading && !error && (
                    <div className="overflow-x-auto rounded-lg border border-gray-300">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c.key} className="text-left p-2 border">
                                            {c.label}
                                        </th>
                                    ))}
                                    <th className="text-right p-2 border">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={columns.length + 1}
                                            className="p-4 text-center text-gray-500"
                                        >
                                            No records match your filters.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((row) => renderRow(row))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

async function saveEntity({ isEditing, endpoint, id, payload, empty, setForm, onMutated, label }) {
    try {
        if (isEditing) {
            await apiClient.put(`/api/${endpoint}/${id}`, payload);
            toastSuccess(`${label} updated`);
        } else {
            await apiClient.post(`/api/${endpoint}`, payload);
            toastSuccess(`${label} added`);
        }
        setForm(empty);
        onMutated();
        return true;
    } catch (err) {
        toastError(err.response?.data?.error || `Error saving ${label.toLowerCase()}`);
        return false;
    }
}

async function deleteEntity({ endpoint, row, onMutated, label }) {
    if (!confirm(`Delete ${label.toLowerCase()} "${row.name}"?`)) return;
    try {
        await apiClient.delete(`/api/${endpoint}/${row.id}`);
        toastSuccess(`${label} deleted`);
        onMutated();
    } catch (err) {
        toastError(err.response?.data?.error || `Error deleting ${label.toLowerCase()}`);
    }
}

/* ---- Towns ---- */
function TownTab({ title, list, loading, error, onMutated }) {
    const empty = { id: null, name: '', isActive: true };
    const [form, setForm] = useState(empty);
    const [processing, setProcessing] = useState(false);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        await saveEntity({
            isEditing,
            endpoint: 'towns',
            id: form.id,
            payload: { name: form.name, isActive: form.isActive },
            empty,
            setForm,
            onMutated,
            label: title,
        });
        setProcessing(false);
    };

    return (
        <EntitySection
            title={isEditing ? `Edit ${title}` : `Add ${title}`}
            loading={loading}
            error={error}
            list={list}
            searchKeys={['name']}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'status', label: 'Status' },
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-1">Name</label>
                        <input
                            type="text"
                            className="border p-2 rounded-input w-full"
                            placeholder="Town name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <ActiveToggle
                        id="town-active"
                        checked={form.isActive}
                        onChange={(isActive) => setForm({ ...form, isActive })}
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setForm(empty)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.isActive ? 'opacity-70' : ''}`}>
                    <td className="p-2 border font-medium">{row.name}</td>
                    <td className="p-2 border">
                        <StatusBadge active={row.isActive} />
                    </td>
                    <td className="p-2 border text-right space-x-3">
                        <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() =>
                                setForm({
                                    id: row.id,
                                    name: row.name,
                                    isActive: row.isActive !== false,
                                })
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() =>
                                deleteEntity({
                                    endpoint: 'towns',
                                    row,
                                    onMutated,
                                    label: title,
                                })
                            }
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ---- Salesmen ---- */
function SalesmanTab({ title, list, loading, error, onMutated }) {
    const empty = { id: null, name: '', phone: '', isActive: true };
    const [form, setForm] = useState(empty);
    const [processing, setProcessing] = useState(false);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        await saveEntity({
            isEditing,
            endpoint: 'salesmen',
            id: form.id,
            payload: { name: form.name, phone: form.phone, isActive: form.isActive },
            empty,
            setForm,
            onMutated,
            label: title,
        });
        setProcessing(false);
    };

    return (
        <EntitySection
            title={isEditing ? `Edit ${title}` : `Add ${title}`}
            loading={loading}
            error={error}
            list={list}
            searchKeys={['name', 'phone']}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status' },
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-1">Name</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Phone</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Phone"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                    </div>
                    <ActiveToggle
                        id="salesman-active"
                        checked={form.isActive}
                        onChange={(isActive) => setForm({ ...form, isActive })}
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setForm(empty)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.isActive ? 'opacity-70' : ''}`}>
                    <td className="p-2 border font-medium">{row.name}</td>
                    <td className="p-2 border">{row.phone || '—'}</td>
                    <td className="p-2 border">
                        <StatusBadge active={row.isActive} />
                    </td>
                    <td className="p-2 border text-right space-x-3">
                        <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() =>
                                setForm({
                                    id: row.id,
                                    name: row.name,
                                    phone: row.phone || '',
                                    isActive: row.isActive !== false,
                                })
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() =>
                                deleteEntity({
                                    endpoint: 'salesmen',
                                    row,
                                    onMutated,
                                    label: title,
                                })
                            }
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ---- Customers ---- */
function CustomerTab({ title, towns, list, loading, error, onMutated }) {
    const empty = { id: null, name: '', phone: '', townId: '', isActive: true };
    const [form, setForm] = useState(empty);
    const [processing, setProcessing] = useState(false);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        if (!form.townId) {
            toastError('Select a town');
            return;
        }
        setProcessing(true);
        await saveEntity({
            isEditing,
            endpoint: 'customers',
            id: form.id,
            payload: {
                name: form.name,
                phone: form.phone,
                townId: Number(form.townId),
                isActive: form.isActive,
            },
            empty,
            setForm,
            onMutated,
            label: title,
        });
        setProcessing(false);
    };

    return (
        <EntitySection
            title={isEditing ? `Edit ${title}` : `Add ${title}`}
            loading={loading}
            error={error}
            list={list}
            searchKeys={['name', 'phone', 'town']}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'town', label: 'Town' },
                { key: 'status', label: 'Status' },
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-1">Name</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Customer name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Phone</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Phone"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Town</label>
                        <select
                            className="border p-2 rounded-input w-full"
                            value={form.townId}
                            onChange={(e) => setForm({ ...form, townId: e.target.value })}
                            required
                        >
                            <option value="">Select town</option>
                            {towns.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ActiveToggle
                        id="customer-active"
                        checked={form.isActive}
                        onChange={(isActive) => setForm({ ...form, isActive })}
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setForm(empty)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.isActive ? 'opacity-70' : ''}`}>
                    <td className="p-2 border font-medium">{row.name}</td>
                    <td className="p-2 border">{row.phone || '—'}</td>
                    <td className="p-2 border">{row.town?.name || '—'}</td>
                    <td className="p-2 border">
                        <StatusBadge active={row.isActive} />
                    </td>
                    <td className="p-2 border text-right space-x-3">
                        <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() =>
                                setForm({
                                    id: row.id,
                                    name: row.name,
                                    phone: row.phone || '',
                                    townId: row.townId || '',
                                    isActive: row.isActive !== false,
                                })
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() =>
                                deleteEntity({
                                    endpoint: 'customers',
                                    row,
                                    onMutated,
                                    label: title,
                                })
                            }
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ---- Companies ---- */
function CompanyTab({ title, list, loading, error, onMutated }) {
    const empty = { id: null, name: '', phone: '', isActive: true };
    const [form, setForm] = useState(empty);
    const [processing, setProcessing] = useState(false);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        await saveEntity({
            isEditing,
            endpoint: 'companies',
            id: form.id,
            payload: { name: form.name, phone: form.phone, isActive: form.isActive },
            empty,
            setForm,
            onMutated,
            label: title,
        });
        setProcessing(false);
    };

    return (
        <EntitySection
            title={isEditing ? `Edit ${title}` : `Add ${title} / Supplier`}
            loading={loading}
            error={error}
            list={list}
            searchKeys={['name', 'phone']}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status' },
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-1">Company name</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Supplier / company"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Phone</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Phone"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                    </div>
                    <ActiveToggle
                        id="company-active"
                        checked={form.isActive}
                        onChange={(isActive) => setForm({ ...form, isActive })}
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setForm(empty)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.isActive ? 'opacity-70' : ''}`}>
                    <td className="p-2 border font-medium">{row.name}</td>
                    <td className="p-2 border">{row.phone || '—'}</td>
                    <td className="p-2 border">
                        <StatusBadge active={row.isActive} />
                    </td>
                    <td className="p-2 border text-right space-x-3">
                        <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() =>
                                setForm({
                                    id: row.id,
                                    name: row.name,
                                    phone: row.phone || '',
                                    isActive: row.isActive !== false,
                                })
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() =>
                                deleteEntity({
                                    endpoint: 'companies',
                                    row,
                                    onMutated,
                                    label: title,
                                })
                            }
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}

/* ---- Products ---- */
function ProductTab({ title, companies, list, loading, error, onMutated }) {
    const empty = { id: null, name: '', companyId: '', isActive: true };
    const [form, setForm] = useState(empty);
    const [processing, setProcessing] = useState(false);
    const isEditing = form.id != null;

    const submit = async (e) => {
        e.preventDefault();
        if (!form.companyId) {
            toastError('Select a company');
            return;
        }
        setProcessing(true);
        await saveEntity({
            isEditing,
            endpoint: 'products',
            id: form.id,
            payload: {
                name: form.name,
                companyId: Number(form.companyId),
                isActive: form.isActive,
            },
            empty,
            setForm,
            onMutated,
            label: title,
        });
        setProcessing(false);
    };

    return (
        <EntitySection
            title={isEditing ? `Edit ${title}` : `Add ${title}`}
            loading={loading}
            error={error}
            list={list}
            searchKeys={['name', 'company']}
            columns={[
                { key: 'name', label: 'Product' },
                { key: 'company', label: 'Company' },
                { key: 'status', label: 'Status' },
            ]}
            form={
                <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-1">Product name</label>
                        <input
                            className="border p-2 rounded-input w-full"
                            placeholder="Product name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Company</label>
                        <select
                            className="border p-2 rounded-input w-full"
                            value={form.companyId}
                            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                            required
                        >
                            <option value="">Select company</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ActiveToggle
                        id="product-active"
                        checked={form.isActive}
                        onChange={(isActive) => setForm({ ...form, isActive })}
                    />
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Update' : 'Add'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setForm(empty)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            }
            renderRow={(row) => (
                <tr key={row.id} className={`border-b hover:bg-gray-50 ${!row.isActive ? 'opacity-70' : ''}`}>
                    <td className="p-2 border font-medium">{row.name}</td>
                    <td className="p-2 border">{row.company?.name || '—'}</td>
                    <td className="p-2 border">
                        <StatusBadge active={row.isActive} />
                    </td>
                    <td className="p-2 border text-right space-x-3">
                        <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() =>
                                setForm({
                                    id: row.id,
                                    name: row.name,
                                    companyId: row.companyId || '',
                                    isActive: row.isActive !== false,
                                })
                            }
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() =>
                                deleteEntity({
                                    endpoint: 'products',
                                    row,
                                    onMutated,
                                    label: title,
                                })
                            }
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            )}
        />
    );
}
