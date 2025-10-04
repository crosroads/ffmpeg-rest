import { z } from 'zod';

export const AudioToMp3JobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string()
});

export const AudioToWavJobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string()
});

export type AudioToMp3JobData = z.infer<typeof AudioToMp3JobDataSchema>;
export type AudioToWavJobData = z.infer<typeof AudioToWavJobDataSchema>;
