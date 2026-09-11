import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
    const { currentUser, isRestoringSession, signIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isRestoringSession && currentUser) {
        return <Navigate to={location.state?.from ?? '/tickets'} replace />;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            await signIn(email, password);
            navigate(location.state?.from ?? '/tickets', { replace: true });
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-full items-center justify-center px-4 py-16">
            <div className="w-full max-w-sm">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Support Desk</h1>
                <p className="mt-1 text-sm text-slate-500">Sign in to your agent account.</p>

                <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>

                    {errorMessage && (
                        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                        {isSubmitting ? 'Signing in' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-4 text-center text-xs text-slate-400">
                    Accounts are created by an administrator. There is no public sign up.
                </p>
            </div>
        </div>
    );
}
