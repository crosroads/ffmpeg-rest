import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type { AudioToMp3JobData, AudioToWavJobData } from './schemas';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const execFileAsync = promisify(execFile);

const PROCESSING_TIMEOUT = 600000;

export async function processAudioToMp3(job: Job<AudioToMp3JobData>): Promise<JobResult> {
  const { inputPath, outputPath, quality } = job.data;

  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input file does not exist: ${inputPath}`
    };
  }

  try {
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    await execFileAsync('ffmpeg', [
      '-i',
      inputPath,
      '-codec:a',
      'libmp3lame',
      '-qscale:a',
      quality.toString(),
      '-y',
      outputPath
    ], { timeout: PROCESSING_TIMEOUT });

    return {
      success: true,
      outputPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to convert audio to MP3: ${errorMessage}`
    };
  }
}

export async function processAudioToWav(job: Job<AudioToWavJobData>): Promise<JobResult> {
  const { inputPath, outputPath } = job.data;

  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input file does not exist: ${inputPath}`
    };
  }

  try {
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    await execFileAsync('ffmpeg', [
      '-i',
      inputPath,
      '-acodec',
      'pcm_s16le',
      '-ar',
      '44100',
      '-y',
      outputPath
    ], { timeout: PROCESSING_TIMEOUT });

    return {
      success: true,
      outputPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to convert audio to WAV: ${errorMessage}`
    };
  }
}
