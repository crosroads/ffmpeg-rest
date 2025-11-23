import { z } from 'zod';

export const VideoToMp4JobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  crf: z.number().min(0).max(51).default(23),
  preset: z
    .enum(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'])
    .default('medium'),
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
  format: z.enum(['png', 'jpg']).default('png'),
  quality: z.number().min(1).max(31).optional(),
  compress: z.enum(['zip', 'gzip']).optional()
});

export const VideoComposeJobDataSchema = z.object({
  backgroundUrl: z.string().url(),
  backgroundId: z.string().default('default'),
  audioUrl: z.string().url(),
  musicUrl: z.string().url().optional(),
  musicVolume: z.number().min(0).max(1).default(0.4).optional(),
  wordTimestamps: z.array(
    z.object({
      word: z.string(),
      start: z.number().min(0),
      end: z.number().min(0)
    })
  ),
  duration: z.number().min(0),
  watermarkUrl: z.string().url().optional(),
  resolution: z.string().default('1080x1920'),
  watermarkPosition: z
    .enum([
      'top-left',
      'top-center',
      'top-right',
      'middle-left',
      'middle-center',
      'middle-right',
      'bottom-left',
      'bottom-center',
      'bottom-right'
    ])
    .default('bottom-center'),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  primaryColor: z.string().optional(),
  highlightColor: z.string().optional()
});

export type VideoToMp4JobData = z.infer<typeof VideoToMp4JobDataSchema>;
export type VideoExtractAudioJobData = z.infer<typeof VideoExtractAudioJobDataSchema>;
export type VideoExtractFramesJobData = z.infer<typeof VideoExtractFramesJobDataSchema>;
export type VideoComposeJobData = z.infer<typeof VideoComposeJobDataSchema>;
