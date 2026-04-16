import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false
});

export async function checkRedisHealth() {
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error('Redis ping failed');
  }
}
