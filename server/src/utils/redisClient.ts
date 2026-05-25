import { createClient, RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let isRedisDisabled = false;
let client: RedisClientType<any, any> | null = null;
let connectionPromise: Promise<RedisClientType<any, any> | null> | null = null;

export const getRedisClient = async (): Promise<RedisClientType<any, any> | null> => {
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
      client = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 1500, // 1.5 seconds max wait time
          reconnectStrategy: false // Fail fast if Redis is not running locally
        }
      });
      client.on('error', (err: any) => {
        console.error('Redis Client Error', err);
        if (err.code === 'ECONNREFUSED') {
          isRedisDisabled = true;
          client = null;
        }
      });
      await client.connect();
      console.log('✅ Connected to Redis');
      return client;
    } catch (err) {
      console.error('❌ Failed to connect to Redis, disabling Redis caching:', err);
      isRedisDisabled = true;
      client = null;
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

export const redisSet = async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
  try {
    const c = await getRedisClient();
    if (!c) return;
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await c.setEx(key, ttlSeconds, serialized);
    } else {
      await c.set(key, serialized);
    }
  } catch (err) {
    console.error('Redis SET error:', err);
  }
};

export const redisGet = async <T>(key: string): Promise<T | null> => {
  try {
    const c = await getRedisClient();
    if (!c) return null;
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('Redis GET error:', err);
    return null;
  }
};

export const redisDel = async (key: string): Promise<void> => {
  try {
    const c = await getRedisClient();
    if (!c) return;
    await c.del(key);
  } catch (err) {
    console.error('Redis DEL error:', err);
  }
};

export const redisClearPattern = async (pattern: string): Promise<void> => {
  try {
    const c = await getRedisClient();
    if (!c) return;
    const keys = await c.keys(pattern);
    if (keys && keys.length > 0) {
      await c.del(keys);
    }
  } catch (err) {
    console.error('Redis CLEAR PATTERN error:', err);
  }
};
