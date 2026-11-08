import {createContext, useContext, useEffect, useState, useCallback} from 'react';
import apiClient, {setUnauthorizedHandler} from '../apiClient';
import {useNavigate} from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({children}) {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true); // verifying token on mount

    // Verify token with the backend
    const checkAuth = useCallback(async () => {
        try {
            const res = await apiClient('/api/user');
            if (res.status === 200) {
                setUser(res.data.user);
            }
        } catch {
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const clearAuth = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
    }, []);

    // Register the 401 handler once
    useEffect(() => {
        setUnauthorizedHandler(() => {
            clearAuth();
            navigate('/login', {replace: true});
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
                const {data} = await apiClient.get('/api/user');
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

    const logout = async () => {
        try {
            const res = await apiClient.post(`/api/login`, {username, password});

            // Save token and user info to browser storage
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('username', res.data.username);
            // Redirect to dashboard
            navigate('/');
            window.location.reload(); // Refresh to update app state
        } catch (err) {
            console.error(err);
        } finally {
            setUser(null);
        }
    };

    useEffect(() => {
        checkAuth().then(() => {
        });
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{user, loading, login, logout, checkAuth}}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => useContext(AuthContext);