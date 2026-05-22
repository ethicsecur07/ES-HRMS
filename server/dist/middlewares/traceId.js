"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceIdMiddleware = void 0;
const crypto_1 = require("crypto");
const traceIdMiddleware = (req, res, next) => {
    const traceId = req.headers['x-trace-id'] || (0, crypto_1.randomUUID)();
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
};
exports.traceIdMiddleware = traceIdMiddleware;
