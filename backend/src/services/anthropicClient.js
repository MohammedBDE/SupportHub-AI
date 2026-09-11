import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let cachedClient = null;

export function getAnthropicClient() {
    if (!config.anthropic.enabled) {
        return null;
    }

    if (!cachedClient) {
        cachedClient = new Anthropic({ apiKey: config.anthropic.apiKey });
    }

    return cachedClient;
}

export function extractJsonPayload(response) {
    if (response.stop_reason === 'refusal') {
        return null;
    }

    const textBlock = response.content.find((block) => block.type === 'text');

    if (!textBlock || !textBlock.text) {
        return null;
    }

    try {
        return JSON.parse(textBlock.text);
    } catch (error) {
        return null;
    }
}
