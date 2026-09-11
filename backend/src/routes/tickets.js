import { Router } from 'express';
import { query, withTransaction } from '../db/connection.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../config.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/authorize.js';
import { classifyTicket } from '../services/ticketClassifier.js';
import { suggestReply } from '../services/replySuggester.js';

const router = Router();

const MAXIMUM_SUBJECT_LENGTH = 200;
const MAXIMUM_BODY_LENGTH = 20000;
const DEFAULT_PAGE_SIZE = 20;
const MAXIMUM_PAGE_SIZE = 100;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TICKET_SELECT_COLUMNS = `
    tickets.id,
    tickets.created_by,
    tickets.assigned_to,
    tickets.customer_name,
    tickets.customer_email,
    tickets.subject,
    tickets.body,
    tickets.status,
    tickets.priority,
    tickets.category,
    tickets.ai_confidence,
    tickets.ai_classified_at,
    tickets.first_response_at,
    tickets.closed_at,
    tickets.created_at,
    tickets.updated_at,
    creator.full_name AS created_by_name,
    assignee.full_name AS assigned_to_name
`;

const TICKET_JOINS = `
    FROM tickets
    LEFT JOIN users AS creator ON creator.id = tickets.created_by
    LEFT JOIN users AS assignee ON assignee.id = tickets.assigned_to
`;

function parseTicketId(rawValue) {
    const ticketId = Number(rawValue);
    return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
}

function collectTicketErrors({ customerName, customerEmail, subject, body }) {
    const errors = [];

    if (typeof customerName !== 'string' || customerName.trim().length === 0) {
        errors.push('customerName is required');
    }

    if (
        customerEmail !== undefined &&
        customerEmail !== null &&
        customerEmail !== '' &&
        (typeof customerEmail !== 'string' || !EMAIL_PATTERN.test(customerEmail.trim()))
    ) {
        errors.push('customerEmail must be a valid email address');
    }

    if (typeof subject !== 'string' || subject.trim().length === 0) {
        errors.push('subject is required');
    } else if (subject.trim().length > MAXIMUM_SUBJECT_LENGTH) {
        errors.push(`subject must be at most ${MAXIMUM_SUBJECT_LENGTH} characters`);
    }

    if (typeof body !== 'string' || body.trim().length === 0) {
        errors.push('body is required');
    } else if (body.trim().length > MAXIMUM_BODY_LENGTH) {
        errors.push(`body must be at most ${MAXIMUM_BODY_LENGTH} characters`);
    }

    return errors;
}

async function loadVisibleTicket(ticketId, currentUser) {
    const parameters = [ticketId];
    let visibilityClause = '';

    if (currentUser.role !== 'admin') {
        parameters.push(currentUser.id);
        visibilityClause = `AND (tickets.created_by = $2 OR tickets.assigned_to = $2)`;
    }

    const result = await query(
        `SELECT ${TICKET_SELECT_COLUMNS}
         ${TICKET_JOINS}
         WHERE tickets.id = $1 ${visibilityClause}`,
        parameters
    );

    return result.rows[0] ?? null;
}

router.post('/', authenticate, async (request, response, next) => {
    const { customerName, customerEmail, subject, body } = request.body ?? {};

    const validationErrors = collectTicketErrors({ customerName, customerEmail, subject, body });

    if (validationErrors.length > 0) {
        return response.status(400).json({ errors: validationErrors });
    }

    try {
        const insertResult = await query(
            `INSERT INTO tickets (created_by, customer_name, customer_email, subject, body)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                request.currentUser.id,
                customerName.trim(),
                customerEmail ? customerEmail.trim() : null,
                subject.trim(),
                body.trim()
            ]
        );

        const ticketId = insertResult.rows[0].id;

        const classification = await classifyTicket({
            subject: subject.trim(),
            body: body.trim()
        });

        if (classification) {
            await query(
                `UPDATE tickets
                 SET category = $1,
                     priority = $2,
                     ai_confidence = $3,
                     ai_classified_at = now(),
                     updated_at = now()
                 WHERE id = $4`,
                [
                    classification.category,
                    classification.priority,
                    classification.confidence,
                    ticketId
                ]
            );
        }

        const ticket = await loadVisibleTicket(ticketId, request.currentUser);

        return response.status(201).json({
            ticket,
            classification: classification
                ? { ...classification, applied: true }
                : { applied: false, reason: 'classification unavailable or rejected' }
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/', authenticate, async (request, response, next) => {
    const conditions = [];
    const parameters = [];

    if (request.currentUser.role !== 'admin') {
        parameters.push(request.currentUser.id);
        const index = parameters.length;
        conditions.push(`(tickets.created_by = $${index} OR tickets.assigned_to = $${index})`);
    }

    if (TICKET_STATUSES.includes(request.query.status)) {
        parameters.push(request.query.status);
        conditions.push(`tickets.status = $${parameters.length}`);
    }

    if (TICKET_PRIORITIES.includes(request.query.priority)) {
        parameters.push(request.query.priority);
        conditions.push(`tickets.priority = $${parameters.length}`);
    }

    if (TICKET_CATEGORIES.includes(request.query.category)) {
        parameters.push(request.query.category);
        conditions.push(`tickets.category = $${parameters.length}`);
    }

    const searchText = typeof request.query.search === 'string' ? request.query.search.trim() : '';

    if (searchText.length > 0) {
        parameters.push(`%${searchText}%`);
        const index = parameters.length;
        conditions.push(
            `(tickets.subject ILIKE $${index} OR tickets.customer_name ILIKE $${index} OR tickets.body ILIKE $${index})`
        );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const page = Math.max(1, Number(request.query.page) || 1);
    const pageSize = Math.min(
        MAXIMUM_PAGE_SIZE,
        Math.max(1, Number(request.query.pageSize) || DEFAULT_PAGE_SIZE)
    );

    try {
        const countResult = await query(
            `SELECT count(*)::int AS total ${TICKET_JOINS} ${whereClause}`,
            parameters
        );

        const pageParameters = [...parameters, pageSize, (page - 1) * pageSize];

        const ticketsResult = await query(
            `SELECT ${TICKET_SELECT_COLUMNS},
                    (SELECT count(*)::int FROM replies WHERE replies.ticket_id = tickets.id) AS reply_count
             ${TICKET_JOINS}
             ${whereClause}
             ORDER BY tickets.created_at DESC
             LIMIT $${pageParameters.length - 1} OFFSET $${pageParameters.length}`,
            pageParameters
        );

        return response.json({
            tickets: ticketsResult.rows,
            pagination: {
                page,
                pageSize,
                total: countResult.rows[0].total,
                totalPages: Math.ceil(countResult.rows[0].total / pageSize)
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/:id', authenticate, async (request, response, next) => {
    const ticketId = parseTicketId(request.params.id);

    if (ticketId === null) {
        return response.status(400).json({ errors: ['ticket id must be a positive integer'] });
    }

    try {
        const ticket = await loadVisibleTicket(ticketId, request.currentUser);

        if (!ticket) {
            return response.status(404).json({ errors: ['ticket not found'] });
        }

        const repliesResult = await query(
            `SELECT replies.id,
                    replies.ticket_id,
                    replies.author_id,
                    replies.body,
                    replies.is_internal_note,
                    replies.was_ai_suggested,
                    replies.ai_suggestion_text,
                    replies.created_at,
                    users.full_name AS author_name
             FROM replies
             LEFT JOIN users ON users.id = replies.author_id
             WHERE replies.ticket_id = $1
             ORDER BY replies.created_at ASC`,
            [ticketId]
        );

        return response.json({ ticket, replies: repliesResult.rows });
    } catch (error) {
        return next(error);
    }
});

router.patch('/:id/status', authenticate, async (request, response, next) => {
    const ticketId = parseTicketId(request.params.id);
    const { status } = request.body ?? {};

    if (ticketId === null) {
        return response.status(400).json({ errors: ['ticket id must be a positive integer'] });
    }

    if (!TICKET_STATUSES.includes(status)) {
        return response
            .status(400)
            .json({ errors: [`status must be one of: ${TICKET_STATUSES.join(', ')}`] });
    }

    try {
        const ticket = await loadVisibleTicket(ticketId, request.currentUser);

        if (!ticket) {
            return response.status(404).json({ errors: ['ticket not found'] });
        }

        await query(
            `UPDATE tickets
             SET status = $1,
                 closed_at = CASE
                     WHEN $1 IN ('resolved', 'closed') THEN COALESCE(closed_at, now())
                     ELSE NULL
                 END,
                 updated_at = now()
             WHERE id = $2`,
            [status, ticketId]
        );

        const updatedTicket = await loadVisibleTicket(ticketId, request.currentUser);

        return response.json({ ticket: updatedTicket });
    } catch (error) {
        return next(error);
    }
});

router.patch('/:id/assign', authenticate, requireAdmin, async (request, response, next) => {
    const ticketId = parseTicketId(request.params.id);
    const { assignedTo } = request.body ?? {};

    if (ticketId === null) {
        return response.status(400).json({ errors: ['ticket id must be a positive integer'] });
    }

    const assigneeId = assignedTo === null ? null : Number(assignedTo);

    if (assigneeId !== null && !Number.isInteger(assigneeId)) {
        return response.status(400).json({ errors: ['assignedTo must be a user id or null'] });
    }

    try {
        const result = await query(
            `UPDATE tickets
             SET assigned_to = $1, updated_at = now()
             WHERE id = $2
             RETURNING id`,
            [assigneeId, ticketId]
        );

        if (result.rows.length === 0) {
            return response.status(404).json({ errors: ['ticket not found'] });
        }

        const updatedTicket = await loadVisibleTicket(ticketId, request.currentUser);

        return response.json({ ticket: updatedTicket });
    } catch (error) {
        if (error.code === '23503') {
            return response.status(400).json({ errors: ['assignedTo does not match an existing user'] });
        }

        return next(error);
    }
});

router.post('/:id/suggest-reply', authenticate, async (request, response, next) => {
    const ticketId = parseTicketId(request.params.id);

    if (ticketId === null) {
        return response.status(400).json({ errors: ['ticket id must be a positive integer'] });
    }

    try {
        const ticket = await loadVisibleTicket(ticketId, request.currentUser);

        if (!ticket) {
            return response.status(404).json({ errors: ['ticket not found'] });
        }

        const repliesResult = await query(
            `SELECT body, is_internal_note, created_at
             FROM replies
             WHERE ticket_id = $1
             ORDER BY created_at ASC`,
            [ticketId]
        );

        const suggestion = await suggestReply(ticket, repliesResult.rows);

        if (!suggestion.reply) {
            return response.status(503).json({
                errors: [suggestion.unavailableReason ?? 'suggestion unavailable'],
                sources: suggestion.sources
            });
        }

        return response.json({
            suggestion: suggestion.reply,
            grounded: suggestion.grounded,
            sources: suggestion.sources.map((article) => ({
                id: article.id,
                title: article.title,
                category: article.category,
                relevance: Number(article.relevance),
                retrieval: article.retrieval
            }))
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/:id/replies', authenticate, async (request, response, next) => {
    const ticketId = parseTicketId(request.params.id);
    const { body, isInternalNote, wasAiSuggested, aiSuggestionText } = request.body ?? {};

    if (ticketId === null) {
        return response.status(400).json({ errors: ['ticket id must be a positive integer'] });
    }

    if (typeof body !== 'string' || body.trim().length === 0) {
        return response.status(400).json({ errors: ['body is required'] });
    }

    const usedAiSuggestion = Boolean(wasAiSuggested);

    if (usedAiSuggestion && (typeof aiSuggestionText !== 'string' || aiSuggestionText.trim().length === 0)) {
        return response
            .status(400)
            .json({ errors: ['aiSuggestionText is required when wasAiSuggested is true'] });
    }

    try {
        const ticket = await loadVisibleTicket(ticketId, request.currentUser);

        if (!ticket) {
            return response.status(404).json({ errors: ['ticket not found'] });
        }

        const internalNote = Boolean(isInternalNote);

        const reply = await withTransaction(async (client) => {
            const insertResult = await client.query(
                `INSERT INTO replies (ticket_id, author_id, body, is_internal_note, was_ai_suggested, ai_suggestion_text)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, ticket_id, author_id, body, is_internal_note, was_ai_suggested, ai_suggestion_text, created_at`,
                [
                    ticketId,
                    request.currentUser.id,
                    body.trim(),
                    internalNote,
                    usedAiSuggestion,
                    usedAiSuggestion ? aiSuggestionText.trim() : null
                ]
            );

            if (!internalNote) {
                await client.query(
                    `UPDATE tickets
                     SET first_response_at = COALESCE(first_response_at, now()),
                         status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                         updated_at = now()
                     WHERE id = $1`,
                    [ticketId]
                );
            }

            return insertResult.rows[0];
        });

        const updatedTicket = await loadVisibleTicket(ticketId, request.currentUser);

        return response.status(201).json({ reply, ticket: updatedTicket });
    } catch (error) {
        return next(error);
    }
});

export default router;
