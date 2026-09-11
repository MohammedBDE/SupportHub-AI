import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.maximumConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (error) => {
    console.error('Unexpected error on idle database client', error);
});

export function query(sqlText, parameters = []) {
    return pool.query(sqlText, parameters);
}

export async function withTransaction(callback) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function getServerTime() {
    const result = await pool.query('SELECT now() AS server_time');
    return result.rows[0].server_time;
}

export function closePool() {
    return pool.end();
}

export default pool;
