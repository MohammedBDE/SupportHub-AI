import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getServerTime, closePool } from './db/connection.js';
import authRouter from './routes/auth.js';
import ticketsRouter from './routes/tickets.js';
import knowledgeBaseRouter from './routes/knowledgeBase.js';
import analyticsRouter from './routes/analytics.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (request, response) => {
    try {
        const serverTime = await getServerTime();
        response.json({
            status: 'ok',
            databaseTime: serverTime,
            aiEnabled: config.anthropic.enabled,
            embeddingsEnabled: config.embeddings.enabled
        });
    } catch (error) {
        response.status(503).json({ status: 'database unavailable' });
    }
});

app.use('/auth', authRouter);
app.use('/tickets', ticketsRouter);
app.use('/knowledge-base', knowledgeBaseRouter);
app.use('/analytics', analyticsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
    console.log(`AI classification: ${config.anthropic.enabled ? 'enabled' : 'disabled'}`);
    console.log(`Vector search: ${config.embeddings.enabled ? 'enabled' : 'full text fallback'}`);
});

async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);

    server.close(async () => {
        await closePool();
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
