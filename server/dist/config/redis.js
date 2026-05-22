"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_js_1 = require("../utils/logger.js");
// @ts-expect-error missing types
const ioredis_mock_1 = __importDefault(require("ioredis-mock"));
let redisClient = null;
const getRedisClient = async () => {
    if (redisClient && redisClient.status === 'ready') {
        return redisClient;
    }
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    try {
        redisClient = new ioredis_1.default(redisUrl);
        redisClient.on('error', (err) => {
            logger_js_1.logger.error('Redis connection error', { error: err });
        });
        await redisClient.ping();
        logger_js_1.logger.info('Connected to Redis', { url: redisUrl });
        return redisClient;
    }
    catch (err) {
        logger_js_1.logger.error('Failed to connect to Redis, falling back to in‑memory cache', { error: err });
        // fallback to a simple in‑memory map (singleton) – treat as a compatible client
        redisClient = new ioredis_mock_1.default();
        return redisClient;
    }
};
exports.getRedisClient = getRedisClient;
