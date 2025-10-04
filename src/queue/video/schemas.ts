import { z } from 'zod';

export const VideoToMp4JobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  crf: z.number().min(0).max(51).default(23),
  preset: z.enum(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']).default('medium'),
  smartCopy: z.boolean().default(true)
});

export const VideoExtractAudioJobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  mono: z.boolean().default(true)
});

export const VideoExtractFramesJobDataSchema = z.object({
  inputPath: z.string(),
  outputDir: z.string(),
  fps: z.number().default(1),
  compress: z.enum(['zip', 'gzip']).optional()
});

export type VideoToMp4JobData = z.infer<typeof VideoToMp4JobDataSchema>;
export type VideoExtractAudioJobData = z.infer<typeof VideoExtractAudioJobDataSchema>;
export type VideoExtractFramesJobData = z.infer<typeof VideoExtractFramesJobDataSchema>;
