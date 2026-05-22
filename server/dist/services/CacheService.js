"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redisClient_js_1 = require("../utils/redisClient.js");
/**
 * CacheService provides a simple wrapper around Redis for caching operations.
 * It follows a singleton pattern via the exported instance.
 */
class CacheService {
    /** Get a value from cache */
    async get(key) {
        const client = await (0, redisClient_js_1.getRedisClient)();
        if (!client)
            return null;
        const data = await client.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return data;
        }
    }
    async set(key, value, ttlSeconds) {
        const client = await (0, redisClient_js_1.getRedisClient)();
        if (!client)
            return;
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await client.setEx(key, ttlSeconds, stringValue);
        }
        else {
            await client.set(key, stringValue);
        }
    }
    async del(key) {
        const client = await (0, redisClient_js_1.getRedisClient)();
        if (!client)
            return;
        await client.del(key);
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
