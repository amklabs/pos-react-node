// src/pages/Users.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../apiClient.js';
import usePageTitle from '../hooks/usePageTitle.js';
import Spinner from '../components/Spinner.jsx';
import { toastSuccess, toastError } from '../utils/toast';
import { useAuthContext } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmDialogContext.jsx';
import { formatDate } from '../utils/formaters.js';

function emptyForm() {
    return {
        id: null,
        username: '',
        password: '',
        firstname: '',
        lastname: '',
        roleId: '',
        isActive: true,
    };
}

export default function Users() {
    usePageTitle('Users');
    const { user: currentUser } = useAuthContext();
    const confirm = useConfirm();

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showPassword, setShowPassword] = useState(false);

    const isEditing = form.id != null;

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [usersRes, rolesRes] = await Promise.all([
                apiClient.get('/api/users'),
                apiClient.get('/api/roles'),
            ]);
            setUsers(usersRes.data || []);
            setRoles(rolesRes.data || []);
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            if (statusFilter === 'active' && !u.isActive) return false;
            if (statusFilter === 'inactive' && u.isActive) return false;
            if (!q) return true;
            const hay = [
                u.username,
                u.firstname,
                u.lastname,
                u.role?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [users, search, statusFilter]);

    const resetForm = () => {
        setForm(emptyForm());
        setShowPassword(false);
    };

    const startEdit = (u) => {
        setForm({
            id: u.id,
            username: u.username || '',
            password: '',
            firstname: u.firstname || '',
            lastname: u.lastname || '',
            roleId: u.roleId || u.role?.id || '',
            isActive: u.isActive !== false,
        });
        setShowPassword(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.username.trim()) {
            toastError('Username is required');
            return;
        }
        if (!form.roleId) {
            toastError('Select a role');
            return;
        }
        if (!isEditing && (!form.password || form.password.length < 4)) {
            toastError('Password must be at least 4 characters');
            return;
        }
        if (isEditing && form.password && form.password.length < 4) {
            toastError('Password must be at least 4 characters');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                username: form.username.trim(),
                firstname: form.firstname.trim(),
                lastname: form.lastname.trim(),
                roleId: Number(form.roleId),
                isActive: form.isActive,
            };
            if (form.password) payload.password = form.password;

            if (isEditing) {
                await apiClient.put(`/api/users/${form.id}`, payload);
                toastSuccess('User updated');
            } else {
                await apiClient.post('/api/users', payload);
                toastSuccess('User created');
            }
            resetForm();
            await load();
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to save user');
        } finally {
            setSaving(false);
        }
    };

    const removeUser = async (u) => {
        if (u.id === currentUser?.id) {
            toastError('You cannot delete your own account');
            return;
        }
        const ok = await confirm({
            title: 'Delete user?',
            message: `Are you sure you want to delete user "${u.username}"? This cannot be undone.`,
        });
        if (!ok) return;
        try {
            await apiClient.delete(`/api/users/${u.id}`);
            toastSuccess('User deleted');
            if (form.id === u.id) resetForm();
            await load();
        } catch (err) {
            toastError(err.response?.data?.error || 'Failed to delete user');
        }
    };

    return (
        <div className="w-full min-w-0 ">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">User Management</h1>
                <p className=" text-gray-500">
                    Add, update, or remove users and assign roles. Super Admin only.
                </p>
            </div>

            <div className="bg-white px-3 py-2.5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-blue-600 mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className=" font-semibold">
                        {isEditing ? 'Edit user' : 'Add user'}
                    </h2>
                    {isEditing && (
                        <button
                            type="button"
                            className="text-xs text-gray-600 hover:underline cursor-pointer"
                            onClick={resetForm}
                        >
                            Cancel edit
                        </button>
                    )}
                </div>
                <form
                    onSubmit={submit}
                    className="flex flex-wrap xl:flex-nowrap items-end gap-2"
                >
                    <div className="min-w-32 flex-1">
                        <label className="block text-[12px] font-semibold mb-0.5 text-gray-600">
                            Username
                        </label>
                        <input
                            className="border rounded-input w-full "
                            value={form.username}
                            onChange={(e) =>
                                setForm({ ...form, username: e.target.value })
                            }
                            autoComplete="off"
                            required
                        />
                    </div>
                    <div className="min-w-36 flex-1">
                        <label className="block text-[12px] font-semibold mb-0.5 text-gray-600">
                            {isEditing ? 'New password' : 'Password'}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="border pr-14 rounded-input w-full "
                                value={form.password}
                                onChange={(e) =>
                                    setForm({ ...form, password: e.target.value })
                                }
                                autoComplete="new-password"
                                placeholder={isEditing ? 'Keep current' : ''}
                                required={!isEditing}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 px-2 text-[12px] font-semibold text-gray-500 hover:text-brand-700 cursor-pointer"
                                onClick={() => setShowPassword((v) => !v)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                    <div className="min-w-28 flex-1">
                        <label className="block text-[12px] font-semibold mb-0.5 text-gray-600">
                            First name
                        </label>
                        <input
                            className="border rounded-input w-full "
                            value={form.firstname}
                            onChange={(e) =>
                                setForm({ ...form, firstname: e.target.value })
                            }
                        />
                    </div>
                    <div className="min-w-28 flex-1">
                        <label className="block text-[12px] font-semibold mb-0.5 text-gray-600">
                            Last name
                        </label>
                        <input
                            className="border rounded-input w-full "
                            value={form.lastname}
                            onChange={(e) =>
                                setForm({ ...form, lastname: e.target.value })
                            }
                        />
                    </div>
                    <div className="min-w-32 shrink-0">
                        <label className="block text-[12px] font-semibold mb-0.5 text-gray-600">
                            Role
                        </label>
                        <select
                            className="border rounded-input w-full  min-w-32"
                            value={form.roleId}
                            onChange={(e) =>
                                setForm({ ...form, roleId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select role</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <label className="flex items-center cursor-pointer select-none shrink-0 mb-2">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) =>
                                setForm({ ...form, isActive: e.target.checked })
                            }
                            disabled={isEditing && form.id === currentUser?.id}
                            className="cursor-pointer"
                        />
                        <span>Active</span>
                    </label>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving
                            ? 'Saving…'
                            : isEditing
                              ? 'Update'
                              : 'Add'}
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                    <h2 className="text-lg font-semibold">
                        Users{' '}
                        <span className=" font-normal text-gray-500">
                            ({filtered.length}
                            {filtered.length !== users.length
                                ? ` of ${users.length}`
                                : ''}
                            )
                        </span>
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="search"
                            className="border p-2 rounded-input w-full sm:w-64"
                            placeholder="Search users…"
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

                {loading ? (
                    <div className="py-10">
                        <Spinner size="md" label="Loading users..." />
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-300">
                        <table className="w-full  border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="text-left p-2.5 border">Username</th>
                                    <th className="text-left p-2.5 border">Name</th>
                                    <th className="text-left p-2.5 border">Role</th>
                                    <th className="text-left p-2.5 border">Status</th>
                                    <th className="text-left p-2.5 border">Created</th>
                                    <th className="text-right p-2.5 border">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="p-4 text-center text-gray-500"
                                        >
                                            No users match your filters.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((u) => {
                                    const isSelf = u.id === currentUser?.id;
                                    return (
                                        <tr
                                            key={u.id}
                                            className={`border-b hover:bg-gray-50 ${
                                                !u.isActive ? 'opacity-70' : ''
                                            }`}
                                        >
                                            <td className="p-2.5 border font-medium">
                                                {u.username}
                                                {isSelf && (
                                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                                                        You
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5 border">
                                                {[u.firstname, u.lastname]
                                                    .filter(Boolean)
                                                    .join(' ') || '—'}
                                            </td>
                                            <td className="p-2.5 border">
                                                {u.role?.name || '—'}
                                            </td>
                                            <td className="p-2.5 border">
                                                {u.isActive ? (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5 border whitespace-nowrap text-gray-600">
                                                {formatDate(u.createdAt)}
                                            </td>
                                            <td className="p-2.5 border text-right space-x-3 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    className="text-blue-600 hover:underline "
                                                    onClick={() => startEdit(u)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-red-600 hover:underline  disabled:opacity-40 disabled:no-underline"
                                                    onClick={() => removeUser(u)}
                                                    disabled={isSelf}
                                                    title={
                                                        isSelf
                                                            ? 'Cannot delete your own account'
                                                            : 'Delete user'
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
