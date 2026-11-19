import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { hasRole } from '../utils/roles';

/** Restrict nested routes to users whose role is in `roles`. */
export default function RoleRoute({ roles }) {
    const { user } = useAuthContext();

    if (!hasRole(user, roles)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
