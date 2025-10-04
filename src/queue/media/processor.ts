import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type { MediaProbeJobData } from './schemas';

export async function processMediaProbe(_job: Job<MediaProbeJobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}
