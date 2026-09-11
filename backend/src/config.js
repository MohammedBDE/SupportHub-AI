const requiredEnvironmentVariables = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET'
];

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
    (variableName) => !process.env[variableName]
);

if (missingEnvironmentVariables.length > 0) {
    throw new Error(
        `Missing environment variables: ${missingEnvironmentVariables.join(', ')}`
    );
}

export const TICKET_CATEGORIES = ['billing', 'technical', 'account', 'other'];
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
export const USER_ROLES = ['agent', 'admin'];

export const config = {
    port: Number(process.env.PORT) || 3000,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    database: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        maximumConnections: Number(process.env.DB_POOL_MAX) || 10
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        lifetime: process.env.JWT_LIFETIME || '1h'
    },
    anthropic: {
        enabled: Boolean(process.env.ANTHROPIC_API_KEY),
        apiKey: process.env.ANTHROPIC_API_KEY || null,
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-5'
    },
    embeddings: {
        enabled: Boolean(process.env.VOYAGE_API_KEY),
        apiKey: process.env.VOYAGE_API_KEY || null,
        model: process.env.VOYAGE_MODEL || 'voyage-3.5',
        endpoint: 'https://api.voyageai.com/v1/embeddings'
    }
};
