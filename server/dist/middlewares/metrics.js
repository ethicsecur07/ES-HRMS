"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
// Enable collection of default metrics (process, memory, etc.)
prom_client_1.default.collectDefaultMetrics();
const metricsMiddleware = async (req, res, next) => {
    if (req.path !== '/metrics') {
        return next();
    }
    try {
        const metrics = await prom_client_1.default.register.metrics();
        res.setHeader('Content-Type', prom_client_1.default.register.contentType);
        res.end(metrics);
    }
    catch (err) {
        next(err);
    }
};
exports.metricsMiddleware = metricsMiddleware;
