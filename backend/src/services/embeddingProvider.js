import { config } from '../config.js';

export function embeddingsAvailable() {
    return config.embeddings.enabled;
}

export async function createEmbeddings(texts, inputType) {
    if (!config.embeddings.enabled) {
        return null;
    }

    const response = await fetch(config.embeddings.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.embeddings.apiKey}`
        },
        body: JSON.stringify({
            input: texts,
            model: config.embeddings.model,
            input_type: inputType
        })
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Embedding provider returned ${response.status}: ${details}`);
    }

    const payload = await response.json();

    return payload.data
        .sort((first, second) => first.index - second.index)
        .map((item) => item.embedding);
}

export function toVectorLiteral(embedding) {
    return `[${embedding.join(',')}]`;
}
