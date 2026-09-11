import { config, TICKET_CATEGORIES, TICKET_PRIORITIES } from '../config.js';
import { getAnthropicClient, extractJsonPayload } from './anthropicClient.js';

const CLASSIFICATION_SYSTEM_PROMPT = `You classify incoming customer support tickets for a software company.

Choose exactly one category:
- billing: payments, invoices, refunds, subscriptions, pricing
- technical: bugs, errors, outages, integrations, performance
- account: login, passwords, permissions, profile and organisation settings
- other: anything that fits none of the above

Choose exactly one priority:
- urgent: the customer is fully blocked, data is at risk, or a paid service is down
- high: an important workflow is broken but a workaround exists
- medium: a normal request that should be handled within a business day
- low: questions, feedback, and cosmetic issues

Set confidence between 0 and 1 to describe how certain the classification is.
Keep reasoning to a single short sentence.`;

const CLASSIFICATION_SCHEMA = {
    type: 'object',
    properties: {
        category: { type: 'string', enum: TICKET_CATEGORIES },
        priority: { type: 'string', enum: TICKET_PRIORITIES },
        confidence: { type: 'number' },
        reasoning: { type: 'string' }
    },
    required: ['category', 'priority', 'confidence', 'reasoning'],
    additionalProperties: false
};

function isValidClassification(candidate) {
    return (
        candidate !== null &&
        typeof candidate === 'object' &&
        TICKET_CATEGORIES.includes(candidate.category) &&
        TICKET_PRIORITIES.includes(candidate.priority) &&
        typeof candidate.confidence === 'number' &&
        candidate.confidence >= 0 &&
        candidate.confidence <= 1
    );
}

export async function classifyTicket({ subject, body }) {
    const client = getAnthropicClient();

    if (!client) {
        return null;
    }

    try {
        const response = await client.messages.create({
            model: config.anthropic.model,
            max_tokens: 8192,
            system: CLASSIFICATION_SYSTEM_PROMPT,
            output_config: {
                effort: 'low',
                format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA }
            },
            messages: [
                {
                    role: 'user',
                    content: `Subject: ${subject}\n\nMessage:\n${body}`
                }
            ]
        });

        const classification = extractJsonPayload(response);

        if (!isValidClassification(classification)) {
            console.error('Ticket classification rejected by validation', classification);
            return null;
        }

        return {
            category: classification.category,
            priority: classification.priority,
            confidence: Number(classification.confidence.toFixed(3)),
            reasoning: classification.reasoning
        };
    } catch (error) {
        console.error('Ticket classification failed', error);
        return null;
    }
}
