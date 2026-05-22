import { getRedisClient } from '../utils/redisClient.js';

/**
 * CacheService provides a simple wrapper around Redis for caching operations.
 * It follows a singleton pattern via the exported instance.
 */
export class CacheService {
  /** Get a value from cache */
  async get<T>(key: string): Promise<T | null> {
    const client = await getRedisClient();
    if (!client) return null;
    const data = await client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return (data as unknown) as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  }

  async del(key: string): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    await client.del(key);
  }
}

export const cacheService = new CacheService();
