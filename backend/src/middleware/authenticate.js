import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const BEARER_PREFIX = 'Bearer ';

export function authenticate(request, response, next) {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
        return response.status(401).json({ errors: ['missing authorization header'] });
    }

    const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();

    try {
        const payload = jwt.verify(token, config.jwt.secret);

        request.currentUser = {
            id: Number(payload.sub),
            role: payload.role
        };

        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return response.status(401).json({ errors: ['token expired'] });
        }

        return response.status(401).json({ errors: ['invalid token'] });
    }
}
