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
  // Text-based watermark (recommended, priority over image)
  watermarkText: z.string().optional(),
  watermarkFontFamily: z.string().optional(),
  watermarkFontSize: z.number().min(12).max(200).optional(),
  watermarkFontColor: z.string().optional(),
  watermarkBorderWidth: z.number().min(0).max(10).optional(),
  watermarkBorderColor: z.string().optional(),
  watermarkShadowColor: z.string().optional(),
  watermarkShadowX: z.number().min(-20).max(20).optional(),
  watermarkShadowY: z.number().min(-20).max(20).optional(),
  // Watermark background box (for visibility on busy backgrounds)
  watermarkBoxEnabled: z.boolean().default(false).optional(),
  watermarkBoxColor: z.string().default('#000000').optional(),
  watermarkBoxOpacity: z.number().min(0).max(1).default(0.3).optional(),
  watermarkBoxPadding: z.number().min(0).max(50).default(6).optional(),
  // Image-based watermark (legacy, kept for backward compatibility)
  watermarkUrl: z.string().url().optional(),
  watermarkScale: z.number().min(0).max(1).default(0.35).optional(),
  // Common watermark settings
  watermarkOpacity: z.number().min(0).max(1).default(0.85).optional(),
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
  watermarkPadding: z.number().min(0).max(1000).default(475).optional(),
  // Caption font settings
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  primaryColor: z.string().optional(),
  highlightColor: z.string().optional(),
  marginBottom: z.number().min(0).max(2000).optional(), // Caption vertical position (distance from bottom edge in pixels)
  // S3/R2 path prefix for multi-project bucket organization
  pathPrefix: z.string().optional(), // Example: "vicsee/videos" or "easybrainrot/videos"
  // Public CDN URL base for constructing the final video URL
  publicUrl: z.string().url().optional() // Example: "https://assets.vicsee.com" or "https://cdn.easybrainrot.com"
});

export const VideoOverlayJobDataSchema = z.object({
  videoUrl: z.string().url(),
  // Overlay source (one required): bundled asset name OR remote URL
  overlayAsset: z.string().optional(),
  overlayUrl: z.string().url().optional(),
  // Overlay positioning
  overlayPosition: z.enum(['top-right', 'top-left', 'bottom-right', 'bottom-left']).default('top-right'),
  overlayScale: z.number().min(0.01).max(1).default(0.22),
  overlayMarginX: z.number().min(0).max(1000).default(20),
  overlayMarginY: z.number().min(0).max(1000).default(20),
  // S3/R2 path prefix for multi-project bucket organization
  pathPrefix: z.string().optional(),
  publicUrl: z.string().url().optional()
});

export type VideoToMp4JobData = z.infer<typeof VideoToMp4JobDataSchema>;
export type VideoExtractAudioJobData = z.infer<typeof VideoExtractAudioJobDataSchema>;
export type VideoExtractFramesJobData = z.infer<typeof VideoExtractFramesJobDataSchema>;
export type VideoComposeJobData = z.infer<typeof VideoComposeJobDataSchema>;
export type VideoOverlayJobData = z.infer<typeof VideoOverlayJobDataSchema>;
