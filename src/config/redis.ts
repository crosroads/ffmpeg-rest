import IORedis from 'ioredis';
import { env } from './env';

export const createRedisConnection = () => {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 1000, 20000);
      return delay;
    }
  });
};

export const connection = createRedisConnection();
