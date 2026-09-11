const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_STORAGE_KEY = 'support-desk.token';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
    unauthorizedHandler = handler;
}

export function getStoredToken() {
    try {
        return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

export function setStoredToken(token) {
    try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (error) {
        return;
    }
}

export function clearStoredToken() {
    try {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        return;
    }
}

export class ApiError extends Error {
    constructor(status, errors) {
        super(errors[0] ?? 'request failed');
        this.name = 'ApiError';
        this.status = status;
        this.errors = errors;
    }
}

function buildQueryString(parameters) {
    const entries = Object.entries(parameters ?? {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== ''
    );

    if (entries.length === 0) {
        return '';
    }

    return `?${new URLSearchParams(entries).toString()}`;
}

async function request(path, { method = 'GET', body } = {}) {
    const token = getStoredToken();

    const headers = {};

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
    }

    if (response.status === 204) {
        return null;
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new ApiError(response.status, payload.errors ?? ['request failed']);
    }

    return payload;
}

export const api = {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    currentUser: () => request('/auth/me'),
    listStaff: () => request('/auth/users'),
    createStaff: (payload) => request('/auth/register', { method: 'POST', body: payload }),

    listTickets: (filters) => request(`/tickets${buildQueryString(filters)}`),
    getTicket: (ticketId) => request(`/tickets/${ticketId}`),
    createTicket: (payload) => request('/tickets', { method: 'POST', body: payload }),
    updateTicketStatus: (ticketId, status) =>
        request(`/tickets/${ticketId}/status`, { method: 'PATCH', body: { status } }),
    assignTicket: (ticketId, assignedTo) =>
        request(`/tickets/${ticketId}/assign`, { method: 'PATCH', body: { assignedTo } }),
    suggestReply: (ticketId) => request(`/tickets/${ticketId}/suggest-reply`, { method: 'POST' }),
    addReply: (ticketId, payload) =>
        request(`/tickets/${ticketId}/replies`, { method: 'POST', body: payload }),

    listArticles: (search) => request(`/knowledge-base${buildQueryString({ search })}`),

    getAnalytics: (days) => request(`/analytics${buildQueryString({ days })}`)
};
