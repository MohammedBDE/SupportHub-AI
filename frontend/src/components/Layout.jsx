import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

function navigationClassName({ isActive }) {
    const base = 'rounded-md px-3 py-2 text-sm font-medium transition-colors';
    return isActive
        ? `${base} bg-brand-600 text-white`
        : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
}

export default function Layout() {
    const { currentUser, isAdmin, signOut } = useAuth();

    return (
        <div className="min-h-full">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
                    <span className="text-base font-semibold tracking-tight text-slate-900">
                        Support Desk
                    </span>

                    <nav className="flex flex-1 flex-wrap items-center gap-1">
                        <NavLink to="/tickets" className={navigationClassName}>
                            Tickets
                        </NavLink>
                        <NavLink to="/tickets/new" className={navigationClassName}>
                            New ticket
                        </NavLink>
                        <NavLink to="/knowledge-base" className={navigationClassName}>
                            Knowledge base
                        </NavLink>
                        {isAdmin && (
                            <NavLink to="/dashboard" className={navigationClassName}>
                                Dashboard
                            </NavLink>
                        )}
                    </nav>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-900">
                                {currentUser?.fullName}
                            </p>
                            <p className="text-xs text-slate-500">{currentUser?.role}</p>
                        </div>
                        <button
                            type="button"
                            onClick={signOut}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <Outlet />
            </main>
        </div>
    );
}
