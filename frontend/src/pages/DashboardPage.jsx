import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { api } from '../api/client.js';

const CATEGORY_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#94a3b8', '#f59e0b'];

function StatCard({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
    );
}

function formatMinutes(minutes) {
    if (minutes === null || minutes === undefined) {
        return 'No data';
    }

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

function formatPercentage(share) {
    return `${Math.round(share * 100)}%`;
}

export default function DashboardPage() {
    const [analytics, setAnalytics] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    useEffect(() => {
        api.getAnalytics(30)
            .then(setAnalytics)
            .catch((error) => setErrorMessage(error.message));
    }, []);

    if (errorMessage) {
        return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>;
    }

    if (!analytics) {
        return <p className="text-sm text-slate-500">Loading analytics</p>;
    }

    const { totals, responseTimes, aiAdoption } = analytics;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Workspace activity over the last 30 days.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Tickets today"
                    value={totals.tickets_today}
                    hint={`${totals.tickets_last_7_days} in the last 7 days`}
                />
                <StatCard
                    label="Currently open"
                    value={totals.tickets_open}
                    hint={`${totals.total_tickets} tickets in total`}
                />
                <StatCard
                    label="Average first response"
                    value={formatMinutes(responseTimes.average_first_response_minutes)}
                    hint={`Median ${formatMinutes(responseTimes.median_first_response_minutes)}`}
                />
                <StatCard
                    label="AI drafts sent unchanged"
                    value={formatPercentage(aiAdoption.acceptedUnchangedShare)}
                    hint={`${aiAdoption.ai_accepted_unchanged} of ${aiAdoption.ai_assisted_replies} AI assisted replies`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-slate-900">Tickets per day</h2>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    tickFormatter={(value) => value.slice(5)}
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="tickets"
                                    stroke="#4f46e5"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-slate-900">By category</h2>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.byCategory}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    label={(entry) => `${entry.name} (${entry.value})`}
                                >
                                    {analytics.byCategory.map((entry, index) => (
                                        <Cell
                                            key={entry.name}
                                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-slate-900">By priority</h2>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.byPriority}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" name="tickets" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-slate-900">Busiest agents</h2>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="py-2">Agent</th>
                                    <th className="py-2">Replies</th>
                                    <th className="py-2">AI assisted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {analytics.topAgents.map((agent) => (
                                    <tr key={agent.id}>
                                        <td className="py-2 text-slate-800">{agent.name}</td>
                                        <td className="py-2 text-slate-600">{agent.reply_count}</td>
                                        <td className="py-2 text-slate-600">
                                            {agent.ai_assisted_count} (
                                            {formatPercentage(
                                                agent.reply_count > 0
                                                    ? agent.ai_assisted_count / agent.reply_count
                                                    : 0
                                            )}
                                            )
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-400">
                "Sent unchanged" compares the stored AI draft with the reply that was actually sent,
                ignoring leading and trailing whitespace. Edited drafts still count as AI assisted.
            </p>
        </div>
    );
}
