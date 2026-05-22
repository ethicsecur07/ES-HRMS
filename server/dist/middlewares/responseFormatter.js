"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseFormatter = void 0;
const responseFormatter = (req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        const traceId = req.traceId || '';
        // Prevent double wrapping
        if (body && typeof body === 'object' && ('success' in body) && ('traceId' in body)) {
            return originalJson.call(this, body);
        }
        const success = res.statusCode >= 200 && res.statusCode < 300;
        const formattedBody = {
            success,
            traceId
        };
        if (success) {
            formattedBody.message = body?.message || 'Request successful';
            formattedBody.data = body?.data !== undefined ? body.data : (body?.message ? undefined : body);
            if (body?.meta) {
                formattedBody.meta = body.meta;
            }
        }
        else {
            formattedBody.message = body?.message || 'Request failed';
            if (body?.errors)
                formattedBody.errors = body.errors;
            if (body?.stack && process.env.NODE_ENV !== 'production')
                formattedBody.stack = body.stack;
        }
        return originalJson.call(this, formattedBody);
    };
    next();
};
exports.responseFormatter = responseFormatter;
