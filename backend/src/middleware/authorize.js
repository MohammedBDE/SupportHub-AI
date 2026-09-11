export function requireRole(...allowedRoles) {
    return function roleGuard(request, response, next) {
        if (!request.currentUser) {
            return response.status(401).json({ errors: ['authentication required'] });
        }

        if (!allowedRoles.includes(request.currentUser.role)) {
            return response.status(403).json({ errors: ['forbidden'] });
        }

        return next();
    };
}

export const requireAdmin = requireRole('admin');
