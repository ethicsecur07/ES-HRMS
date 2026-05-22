import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
// @ts-expect-error missing types
import MemoryStore from 'ioredis-mock';

let redisClient: Redis | null = null;

export const getRedisClient = async (): Promise<Redis> => {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    redisClient = new Redis(redisUrl);
    redisClient.on('error', (err: any) => {
      logger.error('Redis connection error', { error: err });
    });
    await redisClient.ping();
    logger.info('Connected to Redis', { url: redisUrl });
    return redisClient;
  } catch (err) {
    logger.error('Failed to connect to Redis, falling back to in‑memory cache', { error: err });
    // fallback to a simple in‑memory map (singleton) – treat as a compatible client
    redisClient = new MemoryStore();
    return redisClient as Redis;
  }
};
