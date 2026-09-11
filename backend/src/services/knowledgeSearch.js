import { query } from '../db/connection.js';
import {
    createEmbeddings,
    embeddingsAvailable,
    toVectorLiteral
} from './embeddingProvider.js';

const DEFAULT_RESULT_LIMIT = 3;

async function searchByFullText(searchText, limit) {
    const result = await query(
        `WITH search_query AS (
             SELECT replace(
                 websearch_to_tsquery('english', $1)::text,
                 ' & ',
                 ' | '
             )::tsquery AS terms
         )
         SELECT knowledge_base.id,
                knowledge_base.title,
                knowledge_base.content,
                knowledge_base.category,
                ts_rank(knowledge_base.search_document, search_query.terms) AS relevance
         FROM knowledge_base, search_query
         WHERE knowledge_base.is_published = TRUE
           AND knowledge_base.search_document @@ search_query.terms
         ORDER BY relevance DESC
         LIMIT $2`,
        [searchText, limit]
    );

    return result.rows.map((row) => ({ ...row, retrieval: 'full_text' }));
}

async function searchByEmbedding(searchText, limit) {
    const [embedding] = await createEmbeddings([searchText], 'query');
    const vectorLiteral = toVectorLiteral(embedding);

    const result = await query(
        `SELECT id,
                title,
                content,
                category,
                1 - (embedding <=> $1::vector) AS relevance
         FROM knowledge_base
         WHERE is_published = TRUE
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, limit]
    );

    return result.rows.map((row) => ({ ...row, retrieval: 'vector' }));
}

export async function searchKnowledgeBase(searchText, limit = DEFAULT_RESULT_LIMIT) {
    const trimmedText = (searchText || '').trim();

    if (trimmedText.length === 0) {
        return [];
    }

    if (embeddingsAvailable()) {
        try {
            return await searchByEmbedding(trimmedText, limit);
        } catch (error) {
            console.error('Vector search failed, falling back to full text search', error);
        }
    }

    return searchByFullText(trimmedText, limit);
}

export async function refreshArticleEmbedding(articleId, title, content) {
    if (!embeddingsAvailable()) {
        return false;
    }

    try {
        const [embedding] = await createEmbeddings([`${title}\n\n${content}`], 'document');

        await query(
            `UPDATE knowledge_base
             SET embedding = $1::vector,
                 embedding_generated_at = now()
             WHERE id = $2`,
            [toVectorLiteral(embedding), articleId]
        );

        return true;
    } catch (error) {
        console.error(`Failed to refresh embedding for article ${articleId}`, error);
        return false;
    }
}
