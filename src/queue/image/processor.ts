import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type { ImageToJpgJobData } from './schemas';

export async function processImageToJpg(_job: Job<ImageToJpgJobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}
