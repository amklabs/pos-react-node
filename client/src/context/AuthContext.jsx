import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiClient, { setUnauthorizedHandler } from '../apiClient';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loggingOut, setLoggingOut] = useState(false);

    const clearAuth = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setUser(null);
    }, []);

    // Register the 401 handler once
    useEffect(() => {
        setUnauthorizedHandler(() => {
            clearAuth();
            navigate('/login', { replace: true });
        });
        return () => setUnauthorizedHandler(null);
    }, [clearAuth, navigate]);

    // Verify token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const { data } = await apiClient.get('/api/user');
                if (!cancelled) setUser(data.user);
            } catch {
                if (!cancelled) clearAuth();
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [clearAuth]);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('username', userData.username);
        setUser(userData);
    };

    const logout = useCallback(async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await apiClient.post('/api/logout');
        } catch {
            // Still clear local session even if the server call fails
        } finally {
            clearAuth();
            setLoggingOut(false);
            navigate('/login', { replace: true });
        }
    }, [clearAuth, navigate, loggingOut]);

    return (
        <AuthContext.Provider value={{ user, loading, loggingOut, login, logout }}>
            {children}
            {loggingOut && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] print:hidden"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className="mx-4 flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-lg">
                        <span
                            className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
                            aria-hidden
                        />
                        <span className="text-sm font-semibold text-gray-800">
                            Signing out…
                        </span>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => useContext(AuthContext);
