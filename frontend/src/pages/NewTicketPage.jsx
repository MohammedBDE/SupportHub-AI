import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const fieldClassName =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export default function NewTicketPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        customerName: '',
        customerEmail: '',
        subject: '',
        body: ''
    });
    const [errors, setErrors] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function updateField(key, value) {
        setForm((previous) => ({ ...previous, [key]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setErrors([]);
        setIsSubmitting(true);

        try {
            const payload = await api.createTicket(form);
            navigate(`/tickets/${payload.ticket.id}`, { replace: true });
        } catch (error) {
            setErrors(error.errors ?? [error.message]);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">New ticket</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Log a request received by email or phone. The assistant classifies it automatically
                    once it is saved.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="customerName" className="block text-sm font-medium text-slate-700">
                            Customer name
                        </label>
                        <input
                            id="customerName"
                            required
                            value={form.customerName}
                            onChange={(event) => updateField('customerName', event.target.value)}
                            className={fieldClassName}
                        />
                    </div>

                    <div>
                        <label htmlFor="customerEmail" className="block text-sm font-medium text-slate-700">
                            Customer email
                        </label>
                        <input
                            id="customerEmail"
                            type="email"
                            value={form.customerEmail}
                            onChange={(event) => updateField('customerEmail', event.target.value)}
                            className={fieldClassName}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
                        Subject
                    </label>
                    <input
                        id="subject"
                        required
                        maxLength={200}
                        value={form.subject}
                        onChange={(event) => updateField('subject', event.target.value)}
                        className={fieldClassName}
                    />
                </div>

                <div>
                    <label htmlFor="body" className="block text-sm font-medium text-slate-700">
                        Message
                    </label>
                    <textarea
                        id="body"
                        required
                        rows={10}
                        value={form.body}
                        onChange={(event) => updateField('body', event.target.value)}
                        className={fieldClassName}
                    />
                </div>

                {errors.length > 0 && (
                    <ul className="space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errors.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                        {isSubmitting ? 'Saving and classifying' : 'Create ticket'}
                    </button>

                    {isSubmitting && (
                        <span className="text-sm text-slate-500">
                            The assistant is reading the message
                        </span>
                    )}
                </div>
            </form>
        </div>
    );
}
