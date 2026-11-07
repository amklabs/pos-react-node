// src/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
    baseURL: API_URL,
});

// Token injection (unchanged)
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// --- 401 handler that defers to the app if it has registered a handler ---
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
    unauthorizedHandler = fn;
}

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {

            // Don't treat a failed login attempt as "session expired"
            const url = error.config?.url || '';
            const isLoginRequest = url.includes('/api/login') || url.includes('/api/register');

            if (!isLoginRequest) {
                localStorage.removeItem('token');
                if (unauthorizedHandler) {
                    // Let React/context/router handle the redirect
                    unauthorizedHandler();
                } else {
                    // Fallback for very early failures before context is ready
                    if (window.location.pathname !== '/login') {
                        window.location.replace('/login');
                    }
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;