import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../components/Badges.jsx';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low'];
const CATEGORY_OPTIONS = ['billing', 'technical', 'account', 'other'];

const selectClassName =
    'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export default function TicketsPage() {
    const [filters, setFilters] = useState({ status: '', priority: '', category: '', search: '' });
    const [searchDraft, setSearchDraft] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadTickets = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const payload = await api.listTickets({ ...filters, page, pageSize: 20 });
            setData(payload);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [filters, page]);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    function updateFilter(key, value) {
        setPage(1);
        setFilters((previous) => ({ ...previous, [key]: value }));
    }

    function handleSearchSubmit(event) {
        event.preventDefault();
        updateFilter('search', searchDraft.trim());
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tickets</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {data ? `${data.pagination.total} tickets match your filters` : 'Loading'}
                    </p>
                </div>

                <Link
                    to="/tickets/new"
                    className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                    New ticket
                </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-64 gap-2">
                    <input
                        type="search"
                        placeholder="Search subject, customer or message"
                        value={searchDraft}
                        onChange={(event) => setSearchDraft(event.target.value)}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Search
                    </button>
                </form>

                <select
                    aria-label="Filter by status"
                    value={filters.status}
                    onChange={(event) => updateFilter('status', event.target.value)}
                    className={selectClassName}
                >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option.replace('_', ' ')}
                        </option>
                    ))}
                </select>

                <select
                    aria-label="Filter by priority"
                    value={filters.priority}
                    onChange={(event) => updateFilter('priority', event.target.value)}
                    className={selectClassName}
                >
                    <option value="">All priorities</option>
                    {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>

                <select
                    aria-label="Filter by category"
                    value={filters.category}
                    onChange={(event) => updateFilter('category', event.target.value)}
                    className={selectClassName}
                >
                    <option value="">All categories</option>
                    {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>

            {errorMessage && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            <tr>
                                <th className="px-4 py-3">Subject</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Priority</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Assignee</th>
                                <th className="px-4 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        Loading tickets
                                    </td>
                                </tr>
                            )}

                            {!isLoading && data?.tickets.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        No tickets match these filters.
                                    </td>
                                </tr>
                            )}

                            {!isLoading &&
                                data?.tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <Link
                                                to={`/tickets/${ticket.id}`}
                                                className="font-medium text-brand-700 hover:underline"
                                            >
                                                {ticket.subject}
                                            </Link>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                #{ticket.id} · {ticket.reply_count} replies
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {ticket.customer_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={ticket.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <PriorityBadge priority={ticket.priority} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <CategoryBadge category={ticket.category} />
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {ticket.assigned_to_name ?? 'Unassigned'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                            {formatDate(ticket.created_at)}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((previous) => previous - 1)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={page >= data.pagination.totalPages}
                            onClick={() => setPage((previous) => previous + 1)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
