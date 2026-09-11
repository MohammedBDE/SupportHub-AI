import { config } from '../config.js';
import { getAnthropicClient, extractJsonPayload } from './anthropicClient.js';
import { searchKnowledgeBase } from './knowledgeSearch.js';

const SUGGESTION_SYSTEM_PROMPT = `You draft replies for human support agents. The agent reads and edits your draft before it reaches the customer.

Absolute rules:
1. Every factual claim in your reply must come from the KNOWLEDGE BASE ARTICLES provided in the user message.
2. Never invent product names, prices, dates, URLs, policies, refund amounts, or troubleshooting steps that are not in those articles.
3. If the articles do not cover the customer's problem, do not guess. Write a short acknowledgement that the request is being escalated to a specialist, and set grounded to false.
4. List in used_article_ids only the article ids you actually relied on. If you relied on none, return an empty array.

Style: address the customer by name, stay warm and concise, use plain language, and end with a clear next step. Do not use placeholders such as [name] or [date].`;

const SUGGESTION_SCHEMA = {
    type: 'object',
    properties: {
        reply: { type: 'string' },
        used_article_ids: {
            type: 'array',
            items: { type: 'integer' }
        },
        grounded: { type: 'boolean' }
    },
    required: ['reply', 'used_article_ids', 'grounded'],
    additionalProperties: false
};

function buildArticlesSection(articles) {
    if (articles.length === 0) {
        return 'KNOWLEDGE BASE ARTICLES:\n(none found for this ticket)';
    }

    const rendered = articles
        .map(
            (article) =>
                `--- ARTICLE id=${article.id} ---\nTitle: ${article.title}\nCategory: ${article.category ?? 'uncategorised'}\n\n${article.content}`
        )
        .join('\n\n');

    return `KNOWLEDGE BASE ARTICLES:\n${rendered}`;
}

function buildConversationSection(replies) {
    if (replies.length === 0) {
        return 'PREVIOUS REPLIES:\n(none)';
    }

    const rendered = replies
        .filter((reply) => !reply.is_internal_note)
        .map((reply) => `Agent (${reply.created_at}): ${reply.body}`)
        .join('\n\n');

    return `PREVIOUS REPLIES:\n${rendered || '(none)'}`;
}

export async function suggestReply(ticket, previousReplies = []) {
    const client = getAnthropicClient();

    const articles = await searchKnowledgeBase(`${ticket.subject} ${ticket.body}`);

    if (!client) {
        return {
            reply: null,
            sources: articles,
            grounded: false,
            unavailableReason: 'anthropic api key is not configured'
        };
    }

    const userContent = [
        `TICKET #${ticket.id}`,
        `Customer name: ${ticket.customer_name}`,
        `Category: ${ticket.category ?? 'unclassified'}`,
        `Priority: ${ticket.priority ?? 'unclassified'}`,
        `Subject: ${ticket.subject}`,
        '',
        `Customer message:\n${ticket.body}`,
        '',
        buildConversationSection(previousReplies),
        '',
        buildArticlesSection(articles)
    ].join('\n');

    try {
        const response = await client.messages.create({
            model: config.anthropic.model,
            max_tokens: 8192,
            system: SUGGESTION_SYSTEM_PROMPT,
            output_config: {
                format: { type: 'json_schema', schema: SUGGESTION_SCHEMA }
            },
            messages: [{ role: 'user', content: userContent }]
        });

        const suggestion = extractJsonPayload(response);

        if (!suggestion || typeof suggestion.reply !== 'string') {
            return {
                reply: null,
                sources: articles,
                grounded: false,
                unavailableReason: 'the model did not return a usable suggestion'
            };
        }

        const availableIds = new Set(articles.map((article) => Number(article.id)));
        const verifiedSourceIds = (suggestion.used_article_ids || [])
            .map(Number)
            .filter((articleId) => availableIds.has(articleId));

        return {
            reply: suggestion.reply,
            sources: articles.filter((article) =>
                verifiedSourceIds.includes(Number(article.id))
            ),
            candidateSources: articles,
            grounded: Boolean(suggestion.grounded) && verifiedSourceIds.length > 0,
            unavailableReason: null
        };
    } catch (error) {
        console.error('Reply suggestion failed', error);

        return {
            reply: null,
            sources: articles,
            grounded: false,
            unavailableReason: 'the assistant is temporarily unavailable'
        };
    }
}
