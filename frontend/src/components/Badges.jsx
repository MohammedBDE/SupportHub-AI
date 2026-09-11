const STATUS_STYLES = {
    open: 'bg-amber-100 text-amber-800 ring-amber-600/20',
    in_progress: 'bg-sky-100 text-sky-800 ring-sky-600/20',
    resolved: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
    closed: 'bg-slate-200 text-slate-700 ring-slate-500/20'
};

const PRIORITY_STYLES = {
    urgent: 'bg-red-100 text-red-800 ring-red-600/20',
    high: 'bg-orange-100 text-orange-800 ring-orange-600/20',
    medium: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
    low: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

const CATEGORY_STYLES = {
    billing: 'bg-violet-100 text-violet-800 ring-violet-600/20',
    technical: 'bg-blue-100 text-blue-800 ring-blue-600/20',
    account: 'bg-teal-100 text-teal-800 ring-teal-600/20',
    other: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

const UNCLASSIFIED_STYLE = 'bg-slate-100 text-slate-500 ring-slate-400/20';

function Badge({ label, className }) {
    return (
        <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${className}`}
        >
            {label}
        </span>
    );
}

export function StatusBadge({ status }) {
    return (
        <Badge
            label={status.replace('_', ' ')}
            className={STATUS_STYLES[status] ?? UNCLASSIFIED_STYLE}
        />
    );
}

export function PriorityBadge({ priority }) {
    return (
        <Badge
            label={priority ?? 'unclassified'}
            className={priority ? PRIORITY_STYLES[priority] : UNCLASSIFIED_STYLE}
        />
    );
}

export function CategoryBadge({ category }) {
    return (
        <Badge
            label={category ?? 'unclassified'}
            className={category ? CATEGORY_STYLES[category] : UNCLASSIFIED_STYLE}
        />
    );
}
