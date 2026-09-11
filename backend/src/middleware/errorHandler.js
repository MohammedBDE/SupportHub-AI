export class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
    }
}

export function notFoundHandler(request, response) {
    response.status(404).json({ errors: ['route not found'] });
}

export function errorHandler(error, request, response, next) {
    if (response.headersSent) {
        return next(error);
    }

    if (error instanceof HttpError) {
        return response.status(error.statusCode).json({ errors: [error.message] });
    }

    if (error.type === 'entity.parse.failed') {
        return response.status(400).json({ errors: ['request body is not valid json'] });
    }

    console.error(error);

    return response.status(500).json({ errors: ['internal server error'] });
}
