import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    HttpError,
    notFoundHandler,
    errorHandler
} from '../src/middleware/errorHandler.js';
import { createMockResponse } from './mockResponse.js';

test('answers unknown routes with 404', () => {
    const response = createMockResponse();

    notFoundHandler({}, response);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { errors: ['route not found'] });
});

test('turns an HttpError into its own status and message', () => {
    const response = createMockResponse();

    errorHandler(new HttpError(409, 'email already registered'), {}, response, mock.fn());

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.body, { errors: ['email already registered'] });
});

test('answers malformed json bodies with 400', () => {
    const response = createMockResponse();
    const parseError = Object.assign(new Error('Unexpected token'), {
        type: 'entity.parse.failed'
    });

    errorHandler(parseError, {}, response, mock.fn());

    assert.equal(response.statusCode, 400);
});

test('hides the details of unexpected errors', (testContext) => {
    testContext.mock.method(console, 'error', () => {});
    const response = createMockResponse();

    errorHandler(new Error('password=hunter2 leaked in stack'), {}, response, mock.fn());

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { errors: ['internal server error'] });
});
