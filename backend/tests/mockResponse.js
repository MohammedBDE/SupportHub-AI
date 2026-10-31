export function createMockResponse() {
    const response = {
        statusCode: null,
        body: null,
        headersSent: false,
        status(statusCode) {
            response.statusCode = statusCode;
            return response;
        },
        json(payload) {
            response.body = payload;
            return response;
        }
    };

    return response;
}
