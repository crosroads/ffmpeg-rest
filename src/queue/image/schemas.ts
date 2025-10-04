import { z } from 'zod';

export const ImageToJpgJobDataSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string()
});

export type ImageToJpgJobData = z.infer<typeof ImageToJpgJobDataSchema>;
