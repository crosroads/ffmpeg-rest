import { createRoute, z } from '@hono/zod-openapi';
import {
  FileSchema,
  ErrorSchema,
  MonoQuerySchema,
  FpsQuerySchema,
  CompressQuerySchema,
  FilenameParamSchema,
  DeleteQuerySchema,
  UrlResponseSchema
} from '~/utils/schemas';

/**
 * GET /video/probe - Probe a remote video URL for metadata (duration, width, height)
 */
export const videoProbeRoute = createRoute({
  method: 'get',
  path: '/video/probe',
  tags: ['Video'],
  summary: 'Probe remote video URL for metadata',
  description:
    'Reads video container metadata (duration, width, height) from a remote URL using ffprobe. Only reads the header — does NOT download the full video file. Typical response time: <1 second.',
  request: {
    query: z.object({
      url: z.string().url().openapi({
        description: 'Remote video URL to probe (must be publicly accessible)',
        example: 'https://cdn.example.com/video.mp4'
      })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            duration: z.number().openapi({
              description: 'Video duration in seconds (float)',
              example: 8.5
            }),
            width: z.number().int().openapi({
              description: 'Video width in pixels',
              example: 1920
            }),
            height: z.number().int().openapi({
              description: 'Video height in pixels',
              example: 1080
            })
          })
        }
      },
      description: 'Video metadata retrieved successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid URL or no video stream found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Probe failed'
    }
  }
});

/**
 * POST /video/overlay - Apply PNG image overlay to a video
 */
export const videoOverlayRoute = createRoute({
  method: 'post',
  path: '/video/overlay',
  tags: ['Video'],
  summary: 'Apply PNG image overlay to a video',
  description:
    'Composites a PNG image (bundled asset or remote URL) onto a video using FFmpeg overlay filter. Audio is preserved via copy codec. Returns S3/R2 URL of the result.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            videoUrl: z.string().url().openapi({
              description: 'Source video URL to process.',
              example: 'https://cdn.example.com/video.mp4'
            }),
            overlayAsset: z.string().optional().openapi({
              description:
                'Bundled asset name in /assets/overlays/ (e.g., "vicsee" loads vicsee.png). Takes priority over overlayUrl if both provided.',
              example: 'vicsee'
            }),
            overlayUrl: z.string().url().optional().openapi({
              description: 'Remote PNG URL to download and use as overlay. Used when overlayAsset is not provided.',
              example: 'https://cdn.example.com/logo.png'
            }),
            overlayPosition: z
              .enum(['top-right', 'top-left', 'bottom-right', 'bottom-left'])
              .default('top-right')
              .openapi({
                description: 'Corner position for the overlay.',
                example: 'top-right'
              }),
            overlayScale: z.number().min(0.01).max(1).default(0.22).openapi({
              description: 'Overlay width as fraction of video width (0.01-1.0). Default: 0.22 (22%).',
              example: 0.22
            }),
            overlayMarginX: z.number().min(0).max(1000).default(20).openapi({
              description: 'Horizontal margin from edge in pixels. Default: 20.',
              example: 20
            }),
            overlayMarginY: z.number().min(0).max(1000).default(20).openapi({
              description: 'Vertical margin from edge in pixels. Default: 20.',
              example: 20
            }),
            pathPrefix: z.string().optional().openapi({
              description:
                'S3/R2 path prefix for storing the output. Example: "vicsee/fern". Default: S3_PATH_PREFIX env var.',
              example: 'vicsee/fern'
            }),
            publicUrl: z.string().url().optional().openapi({
              description:
                'Public CDN URL base for the returned URL. Example: "https://assets.vicsee.com". Default: S3_PUBLIC_URL env var.',
              example: 'https://assets.vicsee.com'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({
              description: 'S3/R2 URL of the overlayed video',
              example: 'https://assets.vicsee.com/vicsee/fern/2026-02-08-abc123/job456.mp4'
            })
          })
        }
      },
      description: 'Video overlay successful'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Bad request or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Processing failed'
    }
  }
});

/**
 * POST /video/merge-audio - Merge video with audio track
 */
export const videoMergeAudioRoute = createRoute({
  method: 'post',
  path: '/video/merge-audio',
  tags: ['Video'],
  summary: 'Merge video with audio track',
  description:
    'Combines a video URL with an audio URL into a single MP4. Supports replace mode (discard original audio) and mix mode (overlay new audio on existing). Video stream is copied without re-encoding when possible.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            videoUrl: z.string().url().openapi({
              description: 'Source video URL (MP4, MOV, WebM)',
              example: 'https://cdn.example.com/video.mp4'
            }),
            audioUrl: z.string().url().openapi({
              description: 'Audio track URL (MP3, WAV, AAC, OGG, M4A)',
              example: 'https://cdn.example.com/audio.mp3'
            }),
            mode: z.enum(['replace', 'mix']).default('replace').openapi({
              description: '"replace" = discard original audio. "mix" = overlay new audio on existing.',
              example: 'replace'
            }),
            volume: z.number().min(0).max(1).optional().openapi({
              description: 'Volume of new audio (0.0-1.0). Default: 1.0 for replace, 0.5 for mix.',
              example: 1.0
            }),
            pathPrefix: z.string().optional().openapi({
              description: 'S3/R2 path prefix for output.',
              example: 'vicsee/dew'
            }),
            publicUrl: z.string().url().optional().openapi({
              description: 'Public CDN base URL for returned URL.',
              example: 'https://assets.vicsee.com'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({
              description: 'S3/R2 URL of merged video',
              example: 'https://assets.vicsee.com/vicsee/dew/2026-02-24-abc/merge.mp4'
            }),
            duration: z.number().openapi({
              description: 'Output duration in seconds',
              example: 5.2
            })
          })
        }
      },
      description: 'Video merge successful'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Bad request or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Processing failed'
    }
  }
});

/**
 * POST /video/mp4 - Convert any video format to MP4
 */
export const videoToMp4Route = createRoute({
  method: 'post',
  path: '/video/mp4',
  tags: ['Video'],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'video/mp4': {
          schema: FileSchema
        }
      },
      description: 'Video converted to MP4 format'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or unsupported format'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Conversion failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/mp4/url - Convert any video format to MP4 and return S3 URL
 */
export const videoToMp4UrlRoute = createRoute({
  method: 'post',
  path: '/video/mp4/url',
  tags: ['Video'],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UrlResponseSchema
        }
      },
      description: 'Video converted to MP4 and uploaded to S3'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Conversion failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/audio - Extract audio track from video
 * Query: mono=yes|no (default: yes for mono/single channel)
 */
export const extractAudioRoute = createRoute({
  method: 'post',
  path: '/video/audio',
  tags: ['Video'],
  request: {
    params: z.object({}),
    query: MonoQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'audio/wav': {
          schema: FileSchema
        }
      },
      description: 'Extracted audio track as WAV file'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or no audio track found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Extraction failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/audio/url - Extract audio track from video and return S3 URL
 * Query: mono=yes|no (default: yes for mono/single channel)
 */
export const extractAudioUrlRoute = createRoute({
  method: 'post',
  path: '/video/audio/url',
  tags: ['Video'],
  request: {
    params: z.object({}),
    query: MonoQuerySchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UrlResponseSchema
        }
      },
      description: 'Extracted audio track uploaded to S3'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Extraction failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/frames - Extract frames from video as PNG images
 * Query: fps=1 (frames per second), compress=zip|gzip (required)
 */
export const extractFramesRoute = createRoute({
  method: 'post',
  path: '/video/frames',
  tags: ['Video'],
  request: {
    query: FpsQuerySchema.merge(CompressQuerySchema),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/zip': {
          schema: FileSchema
        },
        'application/gzip': {
          schema: FileSchema
        }
      },
      description: 'Extracted frames as compressed archive'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or parameters'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Frame extraction failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/frames/url - Extract frames from video and return S3 URL
 * Query: fps=1 (frames per second), compress=zip|gzip (required)
 */
export const extractFramesUrlRoute = createRoute({
  method: 'post',
  path: '/video/frames/url',
  tags: ['Video'],
  request: {
    query: FpsQuerySchema.merge(CompressQuerySchema),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: FileSchema
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UrlResponseSchema
        }
      },
      description: 'Extracted frames archive uploaded to S3'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Invalid video file or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Frame extraction failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * GET /video/frames/:filename - Download extracted frame
 * Query: delete=yes|no (default: yes, deletes file after download)
 */
export const downloadFrameRoute = createRoute({
  method: 'get',
  path: '/video/frames/{filename}',
  tags: ['Video'],
  request: {
    params: FilenameParamSchema,
    query: DeleteQuerySchema
  },
  responses: {
    200: {
      content: {
        'image/png': {
          schema: FileSchema
        }
      },
      description: 'Downloaded frame image'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Frame not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Download failed'
    },
    501: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Not implemented'
    }
  }
});

/**
 * POST /video/compose - Compose video with background, audio, captions, and watermark
 */
export const composeVideoRoute = createRoute({
  method: 'post',
  path: '/video/compose',
  tags: ['Video'],
  summary: 'Compose video with background, audio, captions, and watermark',
  description:
    'Merges background video with audio, adds karaoke-style word-level captions with real-time highlighting, and overlays watermark. Returns S3/R2 URL of final video.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            backgroundUrl: z.string().url().openapi({
              description: 'URL of background video (MP4). Should be longer than audio duration.',
              example: 'https://assets.easybrainrot.com/backgrounds/minecraft-parkour.mp4'
            }),
            backgroundId: z.string().default('default').openapi({
              description:
                'Background identifier for caching (e.g., "minecraft", "subway"). First request downloads and caches, subsequent requests are instant.',
              example: 'minecraft'
            }),
            audioUrl: z.string().url().openapi({
              description: 'URL of audio file (MP3/WAV).',
              example: 'https://assets.easybrainrot.com/audio/abc123.mp3'
            }),
            musicUrl: z.string().url().optional().openapi({
              description:
                'URL of background music (MP3/WAV). Will be mixed with TTS audio at specified volume. Music loops if shorter than video duration.',
              example: 'https://assets.easybrainrot.com/music/energetic-1.mp3'
            }),
            musicVolume: z.number().min(0).max(1).default(0.4).optional().openapi({
              description:
                'Background music volume (0.0-1.0). TTS narration is always at 100%. Default: 0.4 (40%, -8dB, balanced for brainrot). Recommended: 0.2-0.6.',
              example: 0.4
            }),
            wordTimestamps: z
              .array(
                z.object({
                  word: z.string(),
                  start: z.number().min(0),
                  end: z.number().min(0)
                })
              )
              .openapi({
                description: 'Array of word-level timestamps for karaoke captions (required for highlighting effect).',
                example: [
                  { word: 'This', start: 0.0, end: 0.2 },
                  { word: 'is', start: 0.2, end: 0.4 },
                  { word: 'brainrot', start: 0.4, end: 1.0 }
                ]
              }),
            duration: z.number().min(0).openapi({
              description: 'Video duration in seconds (should match audio duration).',
              example: 80.15
            }),
            watermarkText: z.string().optional().openapi({
              description:
                '**Text-based watermark** (recommended). Dynamically renders text with full font control. Priority over watermarkUrl if both provided. Example: "EasyBrainrot.com"',
              example: 'EasyBrainrot.com'
            }),
            watermarkFontFamily: z.string().optional().openapi({
              description:
                'Font family for text watermark. Default: "Liberation-Sans-Bold" (bold, available on Linux). Other options: "Arial-Bold", "DejaVu-Sans-Bold".',
              example: 'Liberation-Sans-Bold'
            }),
            watermarkFontSize: z.number().min(12).max(200).optional().openapi({
              description:
                'Font size for text watermark in pixels. Default: 48px. Recommended: 40-60px for 1080x1920 videos.',
              example: 48
            }),
            watermarkFontColor: z.string().optional().openapi({
              description: 'Font color for text watermark (hex format). Default: "#FFFFFF" (white).',
              example: '#FFFFFF'
            }),
            watermarkBorderWidth: z.number().min(0).max(10).optional().openapi({
              description:
                'Border/outline width for text watermark in pixels. Default: 2px (improves readability on varied backgrounds).',
              example: 2
            }),
            watermarkBorderColor: z.string().optional().openapi({
              description: 'Border/outline color for text watermark (hex format). Default: "#000000" (black).',
              example: '#000000'
            }),
            watermarkShadowColor: z.string().optional().openapi({
              description:
                'Shadow color for text watermark (hex format). Default: "#000000" (black). Adds depth and improves visibility on light backgrounds.',
              example: '#000000'
            }),
            watermarkShadowX: z.number().min(-20).max(20).optional().openapi({
              description:
                'Horizontal shadow offset in pixels. Positive = right, negative = left. Default: 2. Range: -20 to 20.',
              example: 2
            }),
            watermarkShadowY: z.number().min(-20).max(20).optional().openapi({
              description:
                'Vertical shadow offset in pixels. Positive = down, negative = up. Default: 2. Range: -20 to 20.',
              example: 2
            }),
            watermarkBoxEnabled: z.boolean().optional().openapi({
              description:
                'Enable semi-transparent background box behind watermark text for improved visibility on busy backgrounds. Default: false.',
              example: true
            }),
            watermarkBoxColor: z.string().optional().openapi({
              description:
                'Background box color (hex format). Default: "#000000" (black). Only used when watermarkBoxEnabled is true.',
              example: '#000000'
            }),
            watermarkBoxOpacity: z.number().min(0).max(1).optional().openapi({
              description:
                'Background box opacity (0.0-1.0). Default: 0.3 (30%, subtle). Recommended: 0.2-0.4 for readability without being intrusive.',
              example: 0.3
            }),
            watermarkBoxPadding: z.number().min(0).max(50).optional().openapi({
              description: 'Padding around watermark text inside the box in pixels. Default: 6px. Range: 0-50.',
              example: 6
            }),
            watermarkUrl: z.string().url().optional().openapi({
              description:
                '**Image-based watermark** (legacy). URL of watermark image (PNG with transparency). Use watermarkText instead for better control. If both provided, watermarkText takes priority.',
              example: 'https://assets.easybrainrot.com/watermark.png'
            }),
            watermarkScale: z.number().min(0).max(1).default(0.35).optional().openapi({
              description:
                'Watermark scale relative to video width (0.0-1.0). Default: 0.35 (35% of video width, aggressive branding). Recommended: 0.30-0.40 for viral marketing balance.',
              example: 0.35
            }),
            watermarkOpacity: z.number().min(0).max(1).default(0.85).optional().openapi({
              description:
                'Watermark opacity/transparency (0.0-1.0). Default: 0.85 (85%, prominent). Recommended: 0.80-0.90 for maximum brand recall while maintaining creator acceptance.',
              example: 0.85
            }),
            resolution: z.string().default('1080x1920').openapi({
              description: 'Output video resolution (WIDTHxHEIGHT).',
              example: '1080x1920'
            }),
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
              .default('bottom-center')
              .openapi({
                description: 'Watermark position on video.',
                example: 'bottom-center'
              }),
            watermarkPadding: z.number().min(0).max(1000).default(475).optional().openapi({
              description:
                'Padding from video edge for watermark position in pixels. Default: 475px (optimized for caption separation). Range: 0-1000.',
              example: 475
            }),
            fontFamily: z.string().optional().openapi({
              description: 'Caption font family.',
              example: 'Arial Black'
            }),
            fontSize: z.number().optional().openapi({
              description: 'Caption font size in pixels.',
              example: 80
            }),
            primaryColor: z.string().optional().openapi({
              description: 'Caption text color (hex format) - color of unspoken words.',
              example: '#FFFFFF'
            }),
            highlightColor: z.string().optional().openapi({
              description:
                'Caption highlight color (hex format) - words transition to this color as they are spoken (karaoke effect).',
              example: '#FFD700'
            }),
            marginBottom: z.number().min(0).max(2000).optional().openapi({
              description:
                'Caption vertical position - distance from bottom edge in pixels (0-2000). Default: 700px (middle zone). Higher values move caption UP toward center. Recommended: 960px for 50% positioning with optimal spacing from watermark.',
              example: 960
            }),
            pathPrefix: z.string().optional().openapi({
              description:
                'S3/R2 path prefix for storing the composed video. Allows multi-project setups to organize videos in separate folders. Example: "vicsee/videos" → uploads to s3://bucket/vicsee/videos/{videoId}.mp4. Default: S3_PATH_PREFIX env var or "videos".',
              example: 'vicsee/videos'
            }),
            publicUrl: z.string().url().optional().openapi({
              description:
                'Public CDN URL base for constructing the final video URL. Allows each project to use its own branded CDN domain. Example: "https://assets.vicsee.com" → returns https://assets.vicsee.com/vicsee/videos/{videoId}.mp4. If not provided, falls back to S3_PUBLIC_URL env var or S3 endpoint.',
              example: 'https://assets.vicsee.com'
            })
          })
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({
              description: 'S3/R2 URL of composed video',
              example: 'https://assets.easybrainrot.com/videos/xyz789.mp4'
            })
          })
        }
      },
      description: 'Video composition successful'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Bad request or S3 mode not enabled'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      },
      description: 'Processing failed'
    }
  }
});
