"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClearPattern = exports.redisDel = exports.redisGet = exports.redisSet = exports.getRedisClient = void 0;
const redis_1 = require("redis");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let isRedisDisabled = false;
let client = null;
let connectionPromise = null;
const getRedisClient = async () => {
    if (isRedisDisabled) {
        return null;
    }
    if (client && client.isOpen) {
        return client;
    }
    if (connectionPromise) {
        return connectionPromise;
    }
    connectionPromise = (async () => {
        try {
            client = (0, redis_1.createClient)({
                url: redisUrl,
                socket: {
                    connectTimeout: 1500, // 1.5 seconds max wait time
                    reconnectStrategy: false // Fail fast if Redis is not running locally
                }
            });
            client.on('error', (err) => {
                console.error('Redis Client Error', err);
                if (err.code === 'ECONNREFUSED') {
                    isRedisDisabled = true;
                    client = null;
                }
            });
            await client.connect();
            console.log('✅ Connected to Redis');
            return client;
        }
        catch (err) {
            console.error('❌ Failed to connect to Redis, disabling Redis caching:', err);
            isRedisDisabled = true;
            client = null;
            return null;
        }
        finally {
            connectionPromise = null;
        }
    })();
    return connectionPromise;
};
exports.getRedisClient = getRedisClient;
const redisSet = async (key, value, ttlSeconds) => {
    try {
        const c = await (0, exports.getRedisClient)();
        if (!c)
            return;
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
            await c.setEx(key, ttlSeconds, serialized);
        }
        else {
            await c.set(key, serialized);
        }
    }
    catch (err) {
        console.error('Redis SET error:', err);
    }
};
exports.redisSet = redisSet;
const redisGet = async (key) => {
    try {
        const c = await (0, exports.getRedisClient)();
        if (!c)
            return null;
        const raw = await c.get(key);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch (err) {
        console.error('Redis GET error:', err);
        return null;
    }
};
exports.redisGet = redisGet;
const redisDel = async (key) => {
    try {
        const c = await (0, exports.getRedisClient)();
        if (!c)
            return;
        await c.del(key);
    }
    catch (err) {
        console.error('Redis DEL error:', err);
    }
};
exports.redisDel = redisDel;
const redisClearPattern = async (pattern) => {
    try {
        const c = await (0, exports.getRedisClient)();
        if (!c)
            return;
        const keys = await c.keys(pattern);
        if (keys && keys.length > 0) {
            await c.del(keys);
        }
    }
    catch (err) {
        console.error('Redis CLEAR PATTERN error:', err);
    }
};
exports.redisClearPattern = redisClearPattern;
