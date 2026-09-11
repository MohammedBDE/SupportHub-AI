import { Router } from 'express';
import { query } from '../db/connection.js';
import { TICKET_CATEGORIES } from '../config.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/authorize.js';
import { refreshArticleEmbedding, searchKnowledgeBase } from '../services/knowledgeSearch.js';

const router = Router();

const MAXIMUM_TITLE_LENGTH = 200;

function collectArticleErrors({ title, content, category, tags }) {
    const errors = [];

    if (typeof title !== 'string' || title.trim().length === 0) {
        errors.push('title is required');
    } else if (title.trim().length > MAXIMUM_TITLE_LENGTH) {
        errors.push(`title must be at most ${MAXIMUM_TITLE_LENGTH} characters`);
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
        errors.push('content is required');
    }

    if (category !== undefined && category !== null && !TICKET_CATEGORIES.includes(category)) {
        errors.push(`category must be one of: ${TICKET_CATEGORIES.join(', ')}`);
    }

    if (tags !== undefined && !Array.isArray(tags)) {
        errors.push('tags must be an array of strings');
    }

    return errors;
}

router.get('/', authenticate, async (request, response, next) => {
    const searchText = typeof request.query.search === 'string' ? request.query.search.trim() : '';

    try {
        if (searchText.length > 0) {
            const articles = await searchKnowledgeBase(searchText, 10);
            return response.json({ articles });
        }

        const result = await query(
            `SELECT id, title, content, category, tags, is_published, created_at, updated_at
             FROM knowledge_base
             ORDER BY created_at DESC`
        );

        return response.json({ articles: result.rows });
    } catch (error) {
        return next(error);
    }
});

router.get('/:id', authenticate, async (request, response, next) => {
    const articleId = Number(request.params.id);

    if (!Number.isInteger(articleId) || articleId <= 0) {
        return response.status(400).json({ errors: ['article id must be a positive integer'] });
    }

    try {
        const result = await query(
            `SELECT id, title, content, category, tags, is_published, created_at, updated_at
             FROM knowledge_base
             WHERE id = $1`,
            [articleId]
        );

        if (result.rows.length === 0) {
            return response.status(404).json({ errors: ['article not found'] });
        }

        return response.json({ article: result.rows[0] });
    } catch (error) {
        return next(error);
    }
});

router.post('/', authenticate, requireAdmin, async (request, response, next) => {
    const { title, content, category, tags, isPublished } = request.body ?? {};

    const validationErrors = collectArticleErrors({ title, content, category, tags });

    if (validationErrors.length > 0) {
        return response.status(400).json({ errors: validationErrors });
    }

    try {
        const result = await query(
            `INSERT INTO knowledge_base (created_by, title, content, category, tags, is_published)
             VALUES ($1, $2, $3, $4, COALESCE($5, '{}'), COALESCE($6, TRUE))
             RETURNING id, title, content, category, tags, is_published, created_at, updated_at`,
            [
                request.currentUser.id,
                title.trim(),
                content.trim(),
                category ?? null,
                tags ?? null,
                isPublished ?? null
            ]
        );

        const article = result.rows[0];

        await refreshArticleEmbedding(article.id, article.title, article.content);

        return response.status(201).json({ article });
    } catch (error) {
        return next(error);
    }
});

router.put('/:id', authenticate, requireAdmin, async (request, response, next) => {
    const articleId = Number(request.params.id);
    const { title, content, category, tags, isPublished } = request.body ?? {};

    if (!Number.isInteger(articleId) || articleId <= 0) {
        return response.status(400).json({ errors: ['article id must be a positive integer'] });
    }

    const validationErrors = collectArticleErrors({ title, content, category, tags });

    if (validationErrors.length > 0) {
        return response.status(400).json({ errors: validationErrors });
    }

    try {
        const result = await query(
            `UPDATE knowledge_base
             SET title = $1,
                 content = $2,
                 category = $3,
                 tags = COALESCE($4, '{}'),
                 is_published = COALESCE($5, TRUE),
                 updated_at = now()
             WHERE id = $6
             RETURNING id, title, content, category, tags, is_published, created_at, updated_at`,
            [title.trim(), content.trim(), category ?? null, tags ?? null, isPublished ?? null, articleId]
        );

        if (result.rows.length === 0) {
            return response.status(404).json({ errors: ['article not found'] });
        }

        const article = result.rows[0];

        await refreshArticleEmbedding(article.id, article.title, article.content);

        return response.json({ article });
    } catch (error) {
        return next(error);
    }
});

router.delete('/:id', authenticate, requireAdmin, async (request, response, next) => {
    const articleId = Number(request.params.id);

    if (!Number.isInteger(articleId) || articleId <= 0) {
        return response.status(400).json({ errors: ['article id must be a positive integer'] });
    }

    try {
        const result = await query('DELETE FROM knowledge_base WHERE id = $1 RETURNING id', [
            articleId
        ]);

        if (result.rows.length === 0) {
            return response.status(404).json({ errors: ['article not found'] });
        }

        return response.status(204).send();
    } catch (error) {
        return next(error);
    }
});

export default router;
