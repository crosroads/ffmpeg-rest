import { Queue, QueueEvents } from 'bullmq';
import { z } from 'zod';
import { connection } from '~/config/redis';
import { logger } from '~/config/logger';

export const JobType = {
  AUDIO_TO_MP3: 'audio:mp3',
  AUDIO_TO_WAV: 'audio:wav',
  VIDEO_TO_MP4: 'video:mp4',
  VIDEO_EXTRACT_AUDIO: 'video:audio',
  VIDEO_EXTRACT_FRAMES: 'video:frames',
  VIDEO_COMPOSE: 'video:compose',
  VIDEO_OVERLAY: 'video:overlay',
  VIDEO_MERGE_AUDIO: 'video:merge-audio',
  IMAGE_TO_JPG: 'image:jpg',
  MEDIA_PROBE: 'media:info'
} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export const JobResultSchema = z.object({
  success: z.boolean(),
  outputPath: z.string().optional(),
  outputPaths: z.array(z.string()).optional(),
  outputUrl: z.url().optional(),
  outputUrls: z.array(z.url()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional()
});

export type JobResult = z.infer<typeof JobResultSchema>;

export const QUEUE_NAME = 'ffmpeg-jobs';

export const queue = new Queue<unknown, JobResult>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      age: 3600,
      count: 100
    },
    removeOnFail: {
      age: 86400,
      count: 500
    }
  }
});

export const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

export const addJob = async (name: string, data: unknown) => {
  logger.debug({ jobType: name, data }, 'Adding job to queue');

  try {
    const job = await queue.add(name, data);
    logger.info({ jobId: job.id, jobType: name }, 'Job added to queue');
    return job;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobType: name, error: errorMessage }, 'Failed to add job');
    throw error;
  }
};

export const validateJobResult = (result: unknown): JobResult => {
  try {
    console.log('[Validation] Received result:', JSON.stringify(result, null, 2));
    console.log('[Validation] Result type:', typeof result);
    const validated = JobResultSchema.parse(result);
    console.log('[Validation] Successfully validated:', JSON.stringify(validated, null, 2));
    return validated;
  } catch (error) {
    console.error('[Validation] Schema validation error:', error);
    console.error('[Validation] Failed result:', JSON.stringify(result, null, 2));
    logger.error({ error, result }, 'Job result validation failed');
    throw new Error('Invalid job result format from queue');
  }
};
