import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type { VideoToMp4JobData, VideoExtractAudioJobData, VideoExtractFramesJobData } from './schemas';

export async function processVideoToMp4(_job: Job<VideoToMp4JobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}

export async function processVideoExtractAudio(_job: Job<VideoExtractAudioJobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}

export async function processVideoExtractFrames(_job: Job<VideoExtractFramesJobData>): Promise<JobResult> {
  throw new Error('Not implemented yet');
}
