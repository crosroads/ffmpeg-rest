import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

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

export async function checkRedisHealth(): Promise<void> {
  logger.info('🔍 Checking Redis connection...');

  const maxRetries = 30;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await connection.ping();
      const info = await connection.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      logger.info(`✅ Redis health check passed (version: ${version})`);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const delay = Math.min(baseDelay * attempt, 10000);
      if (attempt === maxRetries) {
        logger.error(`❌ Redis health check failed after ${maxRetries} attempts: ${errorMessage}`);
        throw new Error(`Redis health check failed: ${errorMessage}`);
      }
      logger.warn(`Redis attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms... (${errorMessage})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
