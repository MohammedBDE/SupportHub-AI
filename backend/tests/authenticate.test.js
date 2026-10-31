import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { TEST_JWT_SECRET } from './testEnvironment.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { createMockResponse } from './mockResponse.js';

function requestWithAuthorization(authorization) {
    return { headers: authorization ? { authorization } : {} };
}

test('rejects a request without an authorization header', () => {
    const response = createMockResponse();
    const next = mock.fn();

    authenticate(requestWithAuthorization(null), response, next);

    assert.equal(response.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
});

test('rejects a token signed with a different secret', () => {
    const forgedToken = jwt.sign({ role: 'admin' }, 'another-secret', { subject: '1' });
    const response = createMockResponse();
    const next = mock.fn();

    authenticate(requestWithAuthorization(`Bearer ${forgedToken}`), response, next);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { errors: ['invalid token'] });
    assert.equal(next.mock.callCount(), 0);
});

test('rejects an expired token with a specific message', () => {
    const expiredToken = jwt.sign({ role: 'agent' }, TEST_JWT_SECRET, {
        subject: '2',
        expiresIn: -10
    });
    const response = createMockResponse();
    const next = mock.fn();

    authenticate(requestWithAuthorization(`Bearer ${expiredToken}`), response, next);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { errors: ['token expired'] });
});

test('accepts a valid token and attaches the user to the request', () => {
    const validToken = jwt.sign({ role: 'admin' }, TEST_JWT_SECRET, {
        subject: '7',
        expiresIn: '1h'
    });
    const request = requestWithAuthorization(`Bearer ${validToken}`);
    const next = mock.fn();

    authenticate(request, createMockResponse(), next);

    assert.equal(next.mock.callCount(), 1);
    assert.deepEqual(request.currentUser, { id: 7, role: 'admin' });
});
