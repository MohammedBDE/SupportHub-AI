import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole, requireAdmin } from '../src/middleware/authorize.js';
import { createMockResponse } from './mockResponse.js';

test('rejects a request that has no authenticated user', () => {
    const response = createMockResponse();
    const next = mock.fn();

    requireAdmin({}, response, next);

    assert.equal(response.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
});

test('rejects an agent from an admin only route', () => {
    const response = createMockResponse();
    const next = mock.fn();

    requireAdmin({ currentUser: { id: 2, role: 'agent' } }, response, next);

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, { errors: ['forbidden'] });
    assert.equal(next.mock.callCount(), 0);
});

test('lets an admin through an admin only route', () => {
    const response = createMockResponse();
    const next = mock.fn();

    requireAdmin({ currentUser: { id: 1, role: 'admin' } }, response, next);

    assert.equal(next.mock.callCount(), 1);
    assert.equal(response.statusCode, null);
});

test('accepts any role listed in requireRole', () => {
    const guard = requireRole('agent', 'admin');
    const next = mock.fn();

    guard({ currentUser: { id: 2, role: 'agent' } }, createMockResponse(), next);

    assert.equal(next.mock.callCount(), 1);
});
