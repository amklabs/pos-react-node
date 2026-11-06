// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from "../apiClient.js";

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await apiClient.post(`/api/login`, { username, password });

            // Save token and user info to browser storage
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('username', res.data.username);

            // Redirect to dashboard
            navigate('/');
            window.location.reload(); // Refresh to update app state
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-96">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Akhlaq POS Login</h2>

                {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Username</label>
                        <input
                            type="text"
                            className="border p-2 rounded w-full"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Password</label>
                        <input
                            type="password"
                            className="border p-2 rounded w-full"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 mt-2">
                        Log In
                    </button>
                </form>
            </div>
        </div>
    );
}