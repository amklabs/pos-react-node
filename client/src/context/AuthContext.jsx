import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiClient, { setUnauthorizedHandler } from '../apiClient';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

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
        try {
            await apiClient.post('/api/logout');
        } catch {
            // Still clear local session even if the server call fails
        } finally {
            clearAuth();
            navigate('/login', { replace: true });
        }
    }, [clearAuth, navigate]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => useContext(AuthContext);
