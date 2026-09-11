import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { config, USER_ROLES } from '../config.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/authorize.js';

const router = Router();

const BCRYPT_SALT_ROUNDS = 12;
const MINIMUM_PASSWORD_LENGTH = 12;
const MAXIMUM_PASSWORD_LENGTH = 72;
const MAXIMUM_FULL_NAME_LENGTH = 120;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UNIQUE_VIOLATION_CODE = '23505';

const placeholderHashForTimingDefence = bcrypt.hashSync(
    'this-value-is-never-a-real-password',
    BCRYPT_SALT_ROUNDS
);

function collectRegistrationErrors({ email, password, fullName, role }) {
    const errors = [];

    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
        errors.push('email must be a valid email address');
    }

    if (typeof password !== 'string') {
        errors.push('password is required');
    } else if (password.length < MINIMUM_PASSWORD_LENGTH) {
        errors.push(`password must be at least ${MINIMUM_PASSWORD_LENGTH} characters`);
    } else if (password.length > MAXIMUM_PASSWORD_LENGTH) {
        errors.push(`password must be at most ${MAXIMUM_PASSWORD_LENGTH} characters`);
    }

    if (typeof fullName !== 'string' || fullName.trim().length === 0) {
        errors.push('fullName is required');
    } else if (fullName.trim().length > MAXIMUM_FULL_NAME_LENGTH) {
        errors.push(`fullName must be at most ${MAXIMUM_FULL_NAME_LENGTH} characters`);
    }

    if (role !== undefined && !USER_ROLES.includes(role)) {
        errors.push(`role must be one of: ${USER_ROLES.join(', ')}`);
    }

    return errors;
}

router.post('/register', authenticate, requireAdmin, async (request, response, next) => {
    const { email, password, fullName, role } = request.body ?? {};

    const validationErrors = collectRegistrationErrors({ email, password, fullName, role });

    if (validationErrors.length > 0) {
        return response.status(400).json({ errors: validationErrors });
    }

    try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, $2, $3, COALESCE($4, 'agent'))
             RETURNING id, email, full_name, role, is_active, created_at`,
            [email.trim(), passwordHash, fullName.trim(), role ?? null]
        );

        return response.status(201).json({ user: result.rows[0] });
    } catch (error) {
        if (error.code === UNIQUE_VIOLATION_CODE) {
            return response.status(409).json({ errors: ['email is already registered'] });
        }

        return next(error);
    }
});

router.post('/login', async (request, response, next) => {
    const { email, password } = request.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string') {
        return response.status(400).json({ errors: ['email and password are required'] });
    }

    try {
        const result = await query(
            `SELECT id, email, password_hash, full_name, role, is_active
             FROM users
             WHERE email = $1`,
            [email.trim()]
        );

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user ? user.password_hash : placeholderHashForTimingDefence
        );

        if (!user || !passwordMatches || !user.is_active) {
            return response.status(401).json({ errors: ['invalid email or password'] });
        }

        const token = jwt.sign(
            { sub: String(user.id), role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.lifetime }
        );

        return response.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/me', authenticate, async (request, response, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, role, is_active, created_at
             FROM users
             WHERE id = $1 AND is_active = TRUE`,
            [request.currentUser.id]
        );

        if (result.rows.length === 0) {
            return response.status(401).json({ errors: ['account is no longer active'] });
        }

        const user = result.rows[0];

        return response.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/users', authenticate, requireAdmin, async (request, response, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, role, is_active, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        return response.json({ users: result.rows });
    } catch (error) {
        return next(error);
    }
});

export default router;
