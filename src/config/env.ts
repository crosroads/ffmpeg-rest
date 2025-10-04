import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  TEMP_DIR: z.string().default('/tmp/ffmpeg-rest'),
  MAX_FILE_SIZE: z.coerce.number().default(100 * 1024 * 1024),

  WORKER_CONCURRENCY: z.coerce.number().default(5)
});

export const env = schema.parse(process.env);
