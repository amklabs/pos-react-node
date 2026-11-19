// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../apiClient.js';
import { useAuthContext } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle.js';
import { STORE_NAME } from '../constants/store.js';

function EyeIcon({ open }) {
    if (open) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

export default function Login() {
    usePageTitle('Login');
    const [loggingIn, setLoggingIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuthContext();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleLogin = async (e) => {
        e.preventDefault();
        if (loggingIn) return;
        setLoggingIn(true);
        setError('');
        try {
            const res = await apiClient.post(`/api/login`, {
                username: username.trim(),
                password,
            });
            login(res.data.token, res.data.user);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your credentials and try again.');
        } finally {
            setLoggingIn(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
            {/* Background */}
            <div
                className="absolute inset-0 -z-10"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(59,130,246,0.35), transparent 55%),' +
                        'radial-gradient(ellipse 70% 50% at 85% 90%, rgba(30,64,175,0.28), transparent 50%),' +
                        'linear-gradient(160deg, #eff6ff 0%, #dbeafe 40%, #bfdbfe 100%)',
                }}
            />
            <div
                className="absolute inset-0 -z-10 opacity-[0.35]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(30,64,175,0.06) 1px, transparent 1px),' +
                        'linear-gradient(90deg, rgba(30,64,175,0.06) 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                }}
            />
            <div
                className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-400/25 blur-3xl -z-10"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-brand-700/20 blur-3xl -z-10"
                aria-hidden
            />

            <div className="w-full max-w-md animate-slide-up">
                <div className="bg-white/90 backdrop-blur-md border border-white/70 shadow-lg rounded-2xl p-8 sm:p-9">
                    <div className="text-center mb-7">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand-600 mb-2">
                            Point of Sale
                        </p>
                        <h1 className="text-xl sm:text-2xl font-bold text-brand-900 leading-snug tracking-tight text-balance">
                            {STORE_NAME}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Sign in to continue to your workspace
                        </p>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mb-4 rounded-input border border-danger-500/30 bg-danger-50 text-danger-700 px-3 py-2.5 text-sm"
                        >
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
                        <div>
                            <label htmlFor="login-username" className="block text-sm font-semibold mb-1 text-gray-700">
                                Username
                            </label>
                            <input
                                id="login-username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                className="border p-2.5 rounded-input w-full bg-white"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                required
                                disabled={loggingIn}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label htmlFor="login-password" className="block text-sm font-semibold mb-1 text-gray-700">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    autoComplete="current-password"
                                    className="border p-2.5 pr-11 rounded-input w-full bg-white"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                    disabled={loggingIn}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-brand-700 transition-colors"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={0}
                                >
                                    <EyeIcon open={showPassword} />
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full mt-1 h-11 text-base"
                            disabled={loggingIn || !username.trim() || !password}
                        >
                            {loggingIn ? (
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                                        aria-hidden
                                    />
                                    Signing in…
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-5 text-center text-xs text-brand-900/55">
                    Designed and developed by AMK Labs
                </p>
            </div>
        </div>
    );
}
