// src/pages/Login.jsx
import {useState} from 'react';
import {useNavigate, useLocation, Link} from 'react-router-dom';
import apiClient from "../apiClient.js";
import { useAuthContext } from '../context/AuthContext';

export default function Login() {
    const [loggingIn, setLoggingIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuthContext();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoggingIn(true);
        setError('');
        try {
            const res = await apiClient.post(`/api/login`, {username, password});

            login(res.data.token, { username: res.data.username });

            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-96">
                <div className="flex flex-col items-center justify-center mb-4">
                    <span className="text-[50px] font-bold mb-2 text-center text-gray-800">AMK Labs</span>
                    <span className="text-lg">Point of Sales</span>
                </div>
                {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col items-start justify-center">
                        <label className="block text-sm font-semibold mb-1">Username</label>
                        <input
                            type="text"
                            className="border p-2 rounded w-full"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col items-start justify-center">
                        <label className="block text-sm font-semibold mb-1">Password</label>
                        <input
                            type="password"
                            className="border p-2 rounded w-full"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit"
                            className="btn btn-primary">
                        ()Log In
                    </button>
                </form>
            </div>
        </div>
    );
}