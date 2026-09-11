import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ProtectedRoute({ children, adminOnly = false }) {
    const { currentUser, isRestoringSession, isAdmin } = useAuth();
    const location = useLocation();

    if (isRestoringSession) {
        return (
            <div className="flex min-h-full items-center justify-center p-12 text-sm text-slate-500">
                Loading your session
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/tickets" replace />;
    }

    return children;
}
