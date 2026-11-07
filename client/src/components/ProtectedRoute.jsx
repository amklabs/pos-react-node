import {Navigate, Outlet, useLocation} from 'react-router-dom';
import {useAuthContext} from '../context/AuthContext';

export default function ProtectedRoute() {
    const {user, loading} = useAuthContext();
    const location = useLocation();

    // Still verifying token — don't render protected UI yet
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{from: location}}/>;
    }

    return <Outlet/>;
}