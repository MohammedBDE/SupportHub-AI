import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../components/Badges.jsx';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export default function TicketDetailPage() {
    const { ticketId } = useParams();
    const { isAdmin } = useAuth();

    const [ticket, setTicket] = useState(null);
    const [replies, setReplies] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [replyText, setReplyText] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [suggestion, setSuggestion] = useState(null);
    const [suggestionSources, setSuggestionSources] = useState([]);
    const [suggestionNotice, setSuggestionNotice] = useState(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [actionError, setActionError] = useState(null);

    const loadTicket = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            const payload = await api.getTicket(ticketId);
            setTicket(payload.ticket);
            setReplies(payload.replies);
        } catch (error) {
            setLoadError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadTicket();
    }, [loadTicket]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }

        api.listStaff()
            .then((payload) => setStaff(payload.users.filter((person) => person.is_active)))
            .catch(() => setStaff([]));
    }, [isAdmin]);

    async function handleSuggest() {
        setIsSuggesting(true);
        setActionError(null);
        setSuggestionNotice(null);

        try {
            const payload = await api.suggestReply(ticketId);
            setSuggestion(payload.suggestion);
            setSuggestionSources(payload.sources);
            setReplyText(payload.suggestion);

            if (!payload.grounded) {
                setSuggestionNotice(
                    'No knowledge base article covered this ticket, so the draft only acknowledges the request. Verify every detail before sending.'
                );
            }
        } catch (error) {
            setActionError(error.message);
        } finally {
            setIsSuggesting(false);
        }
    }

    async function handleSendReply(event) {
        event.preventDefault();
        setIsSending(true);
        setActionError(null);

        try {
            await api.addReply(ticketId, {
                body: replyText,
                isInternalNote,
                wasAiSuggested: Boolean(suggestion),
                aiSuggestionText: suggestion ?? undefined
            });

            setReplyText('');
            setSuggestion(null);
            setSuggestionSources([]);
            setSuggestionNotice(null);
            setIsInternalNote(false);
            await loadTicket();
        } catch (error) {
            setActionError(error.errors?.[0] ?? error.message);
        } finally {
            setIsSending(false);
        }
    }

    async function handleStatusChange(status) {
        setActionError(null);

        try {
            const payload = await api.updateTicketStatus(ticketId, status);
            setTicket(payload.ticket);
        } catch (error) {
            setActionError(error.message);
        }
    }

    async function handleAssigneeChange(value) {
        setActionError(null);

        try {
            const payload = await api.assignTicket(ticketId, value === '' ? null : Number(value));
            setTicket(payload.ticket);
        } catch (error) {
            setActionError(error.message);
        }
    }

    if (isLoading) {
        return <p className="text-sm text-slate-500">Loading ticket</p>;
    }

    if (loadError) {
        return (
            <div className="space-y-4">
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
                <Link to="/tickets" className="text-sm text-brand-700 hover:underline">
                    Back to tickets
                </Link>
            </div>
        );
    }

    const editedFromSuggestion = suggestion !== null && replyText.trim() !== suggestion.trim();

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-6">
                <div>
                    <Link to="/tickets" className="text-sm text-slate-500 hover:underline">
                        Back to tickets
                    </Link>
                    <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                        {ticket.subject}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        #{ticket.id} · opened {formatDate(ticket.created_at)} by{' '}
                        {ticket.created_by_name ?? 'a removed account'}
                    </p>
                </div>

                <article className="rounded-xl border border-slate-200 bg-white p-5">
                    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                            <p className="text-sm font-medium text-slate-900">{ticket.customer_name}</p>
                            <p className="text-xs text-slate-500">{ticket.customer_email}</p>
                        </div>
                        <p className="text-xs text-slate-400">{formatDate(ticket.created_at)}</p>
                    </header>
                    <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{ticket.body}</p>
                </article>

                <section className="space-y-3">
                    <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
                        Conversation ({replies.length})
                    </h2>

                    {replies.length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            No replies yet.
                        </p>
                    )}

                    {replies.map((reply) => (
                        <article
                            key={reply.id}
                            className={`rounded-xl border p-4 ${
                                reply.is_internal_note
                                    ? 'border-amber-200 bg-amber-50'
                                    : 'border-slate-200 bg-white'
                            }`}
                        >
                            <header className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">
                                    {reply.author_name ?? 'Former agent'}
                                </p>
                                <div className="flex items-center gap-2">
                                    {reply.is_internal_note && (
                                        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                                            internal note
                                        </span>
                                    )}
                                    {reply.was_ai_suggested && (
                                        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                                            {reply.body.trim() === (reply.ai_suggestion_text ?? '').trim()
                                                ? 'ai draft sent as is'
                                                : 'ai draft, edited'}
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400">
                                        {formatDate(reply.created_at)}
                                    </span>
                                </div>
                            </header>
                            <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{reply.body}</p>
                        </article>
                    ))}
                </section>

                <form
                    onSubmit={handleSendReply}
                    className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-900">Write a reply</h2>
                        <button
                            type="button"
                            onClick={handleSuggest}
                            disabled={isSuggesting}
                            className="rounded-md border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                        >
                            {isSuggesting ? 'Reading the knowledge base' : 'Suggest a reply'}
                        </button>
                    </div>

                    {isSuggesting && (
                        <div className="space-y-2 rounded-md bg-slate-50 p-4">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                            <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" />
                        </div>
                    )}

                    {suggestionNotice && (
                        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {suggestionNotice}
                        </p>
                    )}

                    {suggestionSources.length > 0 && (
                        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <p className="font-medium text-slate-700">Grounded in:</p>
                            <ul className="mt-1 space-y-0.5">
                                {suggestionSources.map((source) => (
                                    <li key={source.id}>
                                        {source.title}{' '}
                                        <span className="text-slate-400">
                                            ({source.retrieval}, score {source.relevance.toFixed(3)})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <textarea
                        rows={8}
                        required
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Write your reply, or generate a draft and edit it."
                        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />

                    {suggestion && (
                        <p className="text-xs text-slate-500">
                            {editedFromSuggestion
                                ? 'This will be recorded as an AI draft that you edited.'
                                : 'This will be recorded as an AI draft accepted without changes.'}
                        </p>
                    )}

                    {actionError && (
                        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {actionError}
                        </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={isInternalNote}
                                onChange={(event) => setIsInternalNote(event.target.checked)}
                                className="rounded border-slate-300"
                            />
                            Internal note, not visible to the customer
                        </label>

                        <button
                            type="submit"
                            disabled={isSending}
                            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                            {isSending ? 'Sending' : 'Send reply'}
                        </button>
                    </div>
                </form>
            </div>

            <aside className="space-y-4">
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Status
                        </p>
                        <select
                            value={ticket.status}
                            onChange={(event) => handleStatusChange(event.target.value)}
                            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isAdmin && (
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                Assignee
                            </p>
                            <select
                                value={ticket.assigned_to ?? ''}
                                onChange={(event) => handleAssigneeChange(event.target.value)}
                                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            >
                                <option value="">Unassigned</option>
                                {staff.map((person) => (
                                    <option key={person.id} value={person.id}>
                                        {person.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Assistant classification
                    </p>

                    {ticket.ai_classified_at ? (
                        <>
                            <div className="flex flex-wrap gap-2">
                                <PriorityBadge priority={ticket.priority} />
                                <CategoryBadge category={ticket.category} />
                                <StatusBadge status={ticket.status} />
                            </div>
                            <p className="text-xs text-slate-500">
                                Confidence {Number(ticket.ai_confidence).toFixed(2)} ·{' '}
                                {formatDate(ticket.ai_classified_at)}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">
                            Not classified. The assistant was unavailable or returned a value outside
                            the allowed list.
                        </p>
                    )}
                </div>

                <dl className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">First response</dt>
                        <dd className="text-right text-slate-800">
                            {ticket.first_response_at ? formatDate(ticket.first_response_at) : 'Pending'}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Closed</dt>
                        <dd className="text-right text-slate-800">
                            {ticket.closed_at ? formatDate(ticket.closed_at) : 'Open'}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Last update</dt>
                        <dd className="text-right text-slate-800">{formatDate(ticket.updated_at)}</dd>
                    </div>
                </dl>
            </aside>
        </div>
    );
}
