import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type { AudioToMp3JobData, AudioToWavJobData } from './schemas';

export async function processAudioToMp3(_job: Job<AudioToMp3JobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}

export async function processAudioToWav(_job: Job<AudioToWavJobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}
