# FFmpeg REST API Customization Guide

**Project:** EasyBrainrot Video Composition Microservice
**Date:** November 22, 2025
**Purpose:** Add custom video composition endpoint to Railway FFmpeg template

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Fork & Clone Repository](#step-1-fork--clone-repository)
4. [Step 2: Local Setup](#step-2-local-setup)
5. [Step 3: Add Custom Code](#step-3-add-custom-code)
6. [Step 4: Test Locally](#step-4-test-locally)
7. [Step 5: Push to GitHub](#step-5-push-to-github)
8. [Step 6: Deploy to Railway](#step-6-deploy-to-railway)
9. [Step 7: Configure Environment Variables](#step-7-configure-environment-variables)
10. [Step 8: Test Production](#step-8-test-production)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

We're customizing the `crisog/ffmpeg-rest` template to add a **video composition endpoint** that:
- Merges background video + audio
- Adds word-by-word captions with karaoke highlighting (**REQUIRED FEATURE**)
- Overlays watermark
- Outputs to R2 storage
- Implements background video caching for performance optimization

**What we're adding:**
- New job type: `VIDEO_COMPOSE`
- New API endpoint: `POST /video/compose`
- Caption generator utility (ASS subtitle format with karaoke effect)
- Watermark positioning utility
- Background video caching system
- Integration with existing infrastructure (queue, storage, error handling)

**Key Features:**
- **Karaoke Highlighting**: Words highlight in real-time as they're spoken (gold color transition)
- **Background Caching**: Download backgrounds once, reuse across all requests (saves 30-60s per video)
- **Performance**: First user waits for download, all subsequent users get instant processing

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] **GitHub account** (to fork repository)
- [ ] **Git installed** locally (`git --version` to check)
- [ ] **Node.js 20+** installed (`node --version` to check)
- [ ] **Docker Desktop** installed (for local testing with Redis)
- [ ] **FFmpeg installed** locally (for testing):
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu/Debian
  sudo apt-get install ffmpeg

  # Windows
  # Download from https://ffmpeg.org/download.html
  ```
- [ ] **Railway account** (sign up at https://railway.com)
- [ ] **Cloudflare R2** configured (for storage)

---

## 🍴 Step 1: Fork & Clone Repository

### 1.1 Fork the Repository

1. Go to https://github.com/crisog/ffmpeg-rest
2. Click **"Fork"** button (top right)
3. Select your account
4. Wait for fork to complete
5. Your fork will be at: `https://github.com/YOUR_USERNAME/ffmpeg-rest`

### 1.2 Clone to Local Machine

```bash
# Clone YOUR fork (replace YOUR_USERNAME)
git clone https://github.com/YOUR_USERNAME/ffmpeg-rest.git

# Navigate into directory
cd ffmpeg-rest

# Verify remote
git remote -v
# Should show YOUR repository, not crisog's
```

### 1.3 Create Feature Branch

```bash
# Create and checkout feature branch
git checkout -b feature/video-composition

# Verify you're on the branch
git branch
# Should show: * feature/video-composition
```

---

## 🛠️ Step 2: Local Setup

### 2.1 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify installation
npm run build
# Should complete without errors
```

### 2.2 Start Redis (Required for Queue)

```bash
# Start Redis using Docker Compose
docker-compose up -d

# Verify Redis is running
docker ps
# Should show redis:7-alpine container

# Check Redis logs (optional)
docker-compose logs redis
```

### 2.3 Configure Local Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

**Minimal `.env` for local testing:**
```bash
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
TEMP_DIR=/tmp/ffmpeg-rest
MAX_FILE_SIZE=104857600

# For local testing, use stateless mode first
STORAGE_MODE=stateless

# Later, add R2 credentials for full testing:
# STORAGE_MODE=s3
# S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# S3_REGION=auto
# S3_BUCKET=easybrainrot-assets
# S3_ACCESS_KEY_ID=<your_key>
# S3_SECRET_ACCESS_KEY=<your_secret>
# S3_PUBLIC_URL=https://assets.easybrainrot.com
```

**Save and close** (Ctrl+X, then Y, then Enter in nano)

### 2.4 Verify Local Setup

```bash
# Terminal 1 - Start API server
npm run dev

# Terminal 2 - Start worker
npm run dev:worker

# Terminal 3 - Test health endpoint
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

**If everything works, you're ready to customize!**

Press `Ctrl+C` in both terminals to stop the servers.

---

## 🎨 Step 3: Add Custom Code

Now we'll add our custom video composition functionality.

### 3.1 Create Caption Generator Utility

**File:** `src/utils/ass-generator.ts` (NEW FILE)

```bash
# Create utils directory if it doesn't exist
mkdir -p src/utils

# Create the file
touch src/utils/ass-generator.ts
```

**Add this content:**

```typescript
/**
 * ASS (Advanced SubStation Alpha) Subtitle Generator
 * Generates karaoke-style captions with word-level highlighting
 */

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface ASSGeneratorOptions {
  resolution: string; // e.g., '1080x1920'
  fontFamily?: string; // Default: 'Arial Black'
  fontSize?: number; // Default: 80
  primaryColor?: string; // Default: white (#FFFFFF)
  highlightColor?: string; // Default: gold (#FFD700)
  outlineColor?: string; // Default: black (#000000)
  marginBottom?: number; // Default: 80px from bottom
}

/**
 * Generate ASS subtitle file content from word timestamps
 */
export function generateASS(
  timestamps: WordTimestamp[],
  options: ASSGeneratorOptions
): string {
  const [width, height] = options.resolution.split('x').map(Number);

  const fontFamily = options.fontFamily || 'Arial Black';
  const fontSize = options.fontSize || 80;
  const primaryColor = colorToASS(options.primaryColor || '#FFFFFF');
  const highlightColor = colorToASS(options.highlightColor || '#FFD700');
  const outlineColor = colorToASS(options.outlineColor || '#000000');
  const marginBottom = options.marginBottom || 80;

  // ASS file header
  let ass = `[Script Info]
Title: EasyBrainrot Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,10,10,${marginBottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add karaoke-style dialogue lines
  timestamps.forEach(({ word, start, end }) => {
    const startTime = formatASSTime(start);
    const endTime = formatASSTime(end);
    const duration = Math.round((end - start) * 100); // Convert to centiseconds

    // Karaoke effect: \k<duration> before each word
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,karaoke,{\\k${duration}}${word}\n`;
  });

  return ass;
}

/**
 * Convert hex color to ASS format
 * ASS uses &HAABBGGRR format (alpha, blue, green, red)
 */
function colorToASS(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // ASS format: &H00BBGGRR (00 = fully opaque)
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Format timestamp for ASS subtitle format
 * Format: H:MM:SS.CC (hours:minutes:seconds.centiseconds)
 */
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
```

### 3.2 Create Watermark Position Utility

**File:** `src/utils/watermark-positions.ts` (NEW FILE)

```bash
touch src/utils/watermark-positions.ts
```

**Add this content:**

```typescript
/**
 * Watermark overlay position presets for FFmpeg
 * Returns FFmpeg overlay filter position string
 */

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Get FFmpeg overlay position string for watermark
 *
 * @param position - Predefined position name
 * @param padding - Padding from edges in pixels (default: 20)
 * @returns FFmpeg overlay position string (x:y coordinates)
 */
export function getWatermarkPosition(
  position: WatermarkPosition = 'bottom-center',
  padding: number = 20
): string {
  const positions: Record<WatermarkPosition, string> = {
    'top-left': `${padding}:${padding}`,
    'top-center': `(main_w-overlay_w)/2:${padding}`,
    'top-right': `main_w-overlay_w-${padding}:${padding}`,

    'middle-left': `${padding}:(main_h-overlay_h)/2`,
    'middle-center': `(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
    'middle-right': `main_w-overlay_w-${padding}:(main_h-overlay_h)/2`,

    'bottom-left': `${padding}:main_h-overlay_h-${padding}`,
    'bottom-center': `(main_w-overlay_w)/2:main_h-overlay_h-${padding}`,
    'bottom-right': `main_w-overlay_w-${padding}:main_h-overlay_h-${padding}`,
  };

  return positions[position];
}
```

### 3.3 Create Download Utility with Caching

**File:** `src/utils/download.ts` (NEW FILE)

```bash
touch src/utils/download.ts
```

**Add this content:**

```typescript
import { createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';

/**
 * Download file from URL to local path
 */
export async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await mkdir(dir, { recursive: true });

  // Convert Web ReadableStream to Node.js Readable
  const fileStream = createWriteStream(outputPath);

  // @ts-ignore - Type mismatch between web and node streams
  await pipeline(response.body, fileStream);
}

/**
 * Download multiple files concurrently
 */
export async function downloadFiles(
  downloads: Array<{ url: string; path: string }>
): Promise<void> {
  await Promise.all(
    downloads.map(({ url, path }) => downloadFile(url, path))
  );
}

/**
 * Get background video with caching
 * Downloads on first use, reuses cached file for subsequent requests
 *
 * Cache persists for container lifetime, saving 30-60s per video after first download
 */
export async function getCachedBackgroundVideo(
  backgroundId: string,
  backgroundUrl: string
): Promise<string> {
  const cacheDir = '/app/cache/backgrounds';
  const cachedPath = path.join(cacheDir, `${backgroundId}.mp4`);

  // Check if already cached
  if (existsSync(cachedPath)) {
    console.log(`[Cache HIT] Using cached background: ${backgroundId}`);
    return cachedPath;
  }

  // Cache miss - download and store
  console.log(`[Cache MISS] Downloading background: ${backgroundId} from ${backgroundUrl}`);
  await mkdir(cacheDir, { recursive: true });
  await downloadFile(backgroundUrl, cachedPath);
  console.log(`[Cache STORED] Background cached: ${backgroundId}`);

  return cachedPath;
}
```

**Caching Strategy Explained:**

- **First request** for a background (e.g., "minecraft"): Downloads from R2 (~30-60s), saves to `/app/cache/backgrounds/minecraft.mp4`
- **All subsequent requests**: Uses cached file (instant, no download)
- **Container restart**: Cache is lost, re-downloads on first use (acceptable one-time cost)
- **Disk usage**: 4 backgrounds × ~50MB = 200MB (negligible)
- **Performance gain**: Saves 30-60 seconds per video composition after initial download

### 3.4 Update Queue Processor

**File:** `src/queue/processor.ts` (MODIFY EXISTING)

**Find the `JobType` enum** (around line 10-20) and **add** our new job type:

```typescript
export enum JobType {
  VIDEO_TO_MP4 = 'video:to-mp4',
  VIDEO_EXTRACT_AUDIO = 'video:extract-audio',
  VIDEO_EXTRACT_FRAMES = 'video:extract-frames',
  VIDEO_COMPOSE = 'video:compose',  // ← ADD THIS LINE
  AUDIO_TO_MP3 = 'audio:to-mp3',
  AUDIO_TO_WAV = 'audio:to-wav',
  IMAGE_TO_JPG = 'image:to-jpg',
  MEDIA_PROBE = 'media:probe',
}
```

**Find the processor function** (around line 40-50) and **add** our handler:

```typescript
import { generateASS, type WordTimestamp } from '../utils/ass-generator';
import { getWatermarkPosition, type WatermarkPosition } from '../utils/watermark-positions';
import { downloadFile, getCachedBackgroundVideo } from '../utils/download';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// ... existing imports and code ...

// Find the worker.on('active') section and add before it:

async function processVideoCompose(job: Job): Promise<JobResult> {
  const {
    backgroundUrl,
    backgroundId,  // NEW: Used for caching (e.g., 'minecraft', 'subway')
    audioUrl,
    wordTimestamps,
    duration,
    watermarkUrl,
    resolution = '1080x1920',
    watermarkPosition = 'bottom-center' as WatermarkPosition,
    fontFamily,
    fontSize,
    primaryColor,
    highlightColor,
  } = job.data;

  const jobDir = path.join(env.TEMP_DIR, job.id);

  try {
    // 1. Create temp directory
    await mkdir(jobDir, { recursive: true });

    const audioPath = path.join(jobDir, 'audio.mp3');
    const watermarkPath = path.join(jobDir, 'watermark.png');
    const captionsPath = path.join(jobDir, 'captions.ass');
    const outputPath = path.join(jobDir, 'output.mp4');

    // 2. Generate ASS subtitle file with karaoke highlighting
    // The \k tag creates word-by-word highlighting synchronized with audio
    const assContent = generateASS(wordTimestamps, {
      resolution,
      fontFamily,
      fontSize,
      primaryColor,
      highlightColor,
    });
    await writeFile(captionsPath, assContent, 'utf-8');

    // 3. Get background video (cached for performance)
    // First request downloads, subsequent requests use cache
    const backgroundPath = await getCachedBackgroundVideo(
      backgroundId || 'minecraft',
      backgroundUrl
    );

    // 4. Download audio (and watermark if provided)
    const downloads = [{ url: audioUrl, path: audioPath }];

    if (watermarkUrl) {
      downloads.push({ url: watermarkUrl, path: watermarkPath });
    }

    // Download in parallel for speed
    await Promise.all(
      downloads.map(({ url, path }) => downloadFile(url, path))
    );

    // 5. Build FFmpeg command
    const watermarkOverlayPos = getWatermarkPosition(watermarkPosition);

    let filterComplex = `[0:v]trim=duration=${duration}[bg];`;

    if (watermarkUrl) {
      filterComplex += `[bg][2:v]overlay=${watermarkOverlayPos}[watermarked];`;
      filterComplex += `[watermarked]ass=${captionsPath}[final]`;
    } else {
      filterComplex += `[bg]ass=${captionsPath}[final]`;
    }

    const inputs = [
      `-i ${backgroundPath}`,
      `-i ${audioPath}`,
    ];

    if (watermarkUrl) {
      inputs.push(`-i ${watermarkPath}`);
    }

    const ffmpegCommand = `ffmpeg ${inputs.join(' ')} \
      -filter_complex "${filterComplex}" \
      -map "[final]" -map 1:a \
      -c:v libx264 -preset fast -crf 23 \
      -c:a aac -b:a 192k \
      -r 30 -s ${resolution} \
      -shortest \
      ${outputPath}`;

    console.log('[VideoCompose] Running FFmpeg:', ffmpegCommand);

    // 6. Execute FFmpeg
    const { stdout, stderr } = await execAsync(ffmpegCommand);

    console.log('[VideoCompose] FFmpeg stdout:', stdout);
    if (stderr) console.log('[VideoCompose] FFmpeg stderr:', stderr);

    // 7. Handle storage mode
    let result: JobResult;

    if (env.STORAGE_MODE === 's3') {
      // Upload to S3/R2 with correct signature: (filePath, contentType, originalFilename)
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`);
      result = { success: true, outputUrl: url };
    } else {
      // Stateless mode - return file path
      result = { success: true, outputPath };
    }

    return result;
  } catch (error) {
    console.error('[VideoCompose] Error:', error);
    throw error;
  } finally {
    // Cleanup temp directory (unless in S3 mode where we need the file)
    if (env.STORAGE_MODE !== 's3') {
      await rm(jobDir, { recursive: true, force: true }).catch(console.error);
    }
  }
}

// Now find the processor function and add our case:

worker.process(async (job) => {
  console.log(`Processing job ${job.id} of type ${job.name}`);

  try {
    let result: JobResult;

    switch (job.name as JobType) {
      case JobType.VIDEO_TO_MP4:
        result = await processVideoToMp4(job);
        break;
      case JobType.VIDEO_EXTRACT_AUDIO:
        result = await processVideoExtractAudio(job);
        break;
      case JobType.VIDEO_EXTRACT_FRAMES:
        result = await processVideoExtractFrames(job);
        break;
      case JobType.VIDEO_COMPOSE:  // ← ADD THIS CASE
        result = await processVideoCompose(job);
        break;
      // ... other cases ...
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }

    return result;
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});
```

### 3.5 Add API Schema

**File:** `src/components/video/schemas.ts` (MODIFY EXISTING)

**Add to the end of the file:**

```typescript
import { z } from '@hono/zod-openapi';

// ... existing schemas ...

// ============================================================================
// Video Composition (Custom Addition for EasyBrainrot)
// ============================================================================

export const composeVideoRoute = createRoute({
  method: 'post',
  path: '/video/compose',
  tags: ['video'],
  summary: 'Compose video with background, audio, captions, and watermark',
  description: 'Merges background video with audio, adds karaoke-style captions, and overlays watermark. Returns S3 URL in S3 mode.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            backgroundUrl: z.string().url().openapi({
              description: 'URL of background video (MP4)',
              example: 'https://assets.easybrainrot.com/backgrounds/minecraft-parkour.mp4',
            }),
            audioUrl: z.string().url().openapi({
              description: 'URL of audio file (MP3/WAV)',
              example: 'https://assets.easybrainrot.com/audio/abc123.mp3',
            }),
            wordTimestamps: z.array(z.object({
              word: z.string(),
              start: z.number().min(0),
              end: z.number().min(0),
            })).openapi({
              description: 'Word-level timestamps for captions',
              example: [
                { word: 'This', start: 0.0, end: 0.2 },
                { word: 'is', start: 0.2, end: 0.4 },
                { word: 'brainrot', start: 0.4, end: 1.0 },
              ],
            }),
            duration: z.number().min(0).openapi({
              description: 'Video duration in seconds',
              example: 80.15,
            }),
            watermarkUrl: z.string().url().optional().openapi({
              description: 'URL of watermark image (PNG with transparency)',
              example: 'https://assets.easybrainrot.com/watermark.png',
            }),
            resolution: z.string().default('1080x1920').openapi({
              description: 'Output video resolution (WIDTHxHEIGHT)',
              example: '1080x1920',
            }),
            watermarkPosition: z.enum([
              'top-left', 'top-center', 'top-right',
              'middle-left', 'middle-center', 'middle-right',
              'bottom-left', 'bottom-center', 'bottom-right',
            ]).default('bottom-center').openapi({
              description: 'Watermark position on video',
            }),
            fontFamily: z.string().optional().openapi({
              description: 'Caption font family',
              example: 'Arial Black',
            }),
            fontSize: z.number().optional().openapi({
              description: 'Caption font size',
              example: 80,
            }),
            primaryColor: z.string().optional().openapi({
              description: 'Caption text color (hex)',
              example: '#FFFFFF',
            }),
            highlightColor: z.string().optional().openapi({
              description: 'Caption highlight color (hex)',
              example: '#FFD700',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({
              description: 'S3/R2 URL of composed video',
              example: 'https://assets.easybrainrot.com/videos/xyz789.mp4',
            }),
          }),
        },
      },
      description: 'Video composition successful (S3 mode)',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Bad request or S3 mode not enabled',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            message: z.string().optional(),
          }),
        },
      },
      description: 'Processing failed',
    },
  },
});
```

### 3.6 Add API Controller

**File:** `src/components/video/controller.ts` (MODIFY EXISTING)

**Add import at the top:**

```typescript
import { composeVideoRoute } from './schemas';
```

**Add endpoint handler (at the end of the `registerVideoRoutes` function, before the closing brace):**

```typescript
export function registerVideoRoutes(app: OpenAPIHono) {
  // ... existing routes ...

  // ============================================================================
  // Video Composition Endpoint (Custom Addition)
  // ============================================================================

  app.openapi(composeVideoRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json(
          {
            error: 'S3 mode required',
            message: 'Video composition requires STORAGE_MODE=s3 in environment variables',
          },
          400
        );
      }

      const body = c.req.valid('json');

      console.log('[VideoCompose] Received request:', {
        backgroundUrl: body.backgroundUrl,
        audioUrl: body.audioUrl,
        duration: body.duration,
        wordCount: body.wordTimestamps.length,
        resolution: body.resolution,
        hasWatermark: !!body.watermarkUrl,
      });

      // Queue the job
      const job = await addJob(JobType.VIDEO_COMPOSE, {
        backgroundUrl: body.backgroundUrl,
        audioUrl: body.audioUrl,
        wordTimestamps: body.wordTimestamps,
        duration: body.duration,
        watermarkUrl: body.watermarkUrl,
        resolution: body.resolution,
        watermarkPosition: body.watermarkPosition,
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        primaryColor: body.primaryColor,
        highlightColor: body.highlightColor,
      });

      console.log(`[VideoCompose] Job queued: ${job.id}`);

      // Wait for completion
      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        console.error('[VideoCompose] Job failed:', result.error);
        return c.json(
          {
            error: result.error || 'Video composition failed',
          },
          400
        );
      }

      console.log(`[VideoCompose] Job complete: ${result.outputUrl}`);

      return c.json({ url: result.outputUrl }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[VideoCompose] Error:', errorMessage);

      return c.json(
        {
          error: 'Processing failed',
          message: errorMessage,
        },
        500
      );
    }
  });
}
```

---

## ✅ Step 3 Complete!

**Files created:**
- ✅ `src/utils/ass-generator.ts`
- ✅ `src/utils/watermark-positions.ts`
- ✅ `src/utils/download.ts`

**Files modified:**
- ✅ `src/queue/processor.ts`
- ✅ `src/components/video/schemas.ts`
- ✅ `src/components/video/controller.ts`

**Next:** Test locally before pushing to GitHub.

---

## 🧪 Step 4: Test Locally

### 4.1 Build the Project

```bash
# Build TypeScript
npm run build

# Should complete without errors
# If you see errors, check the code additions above
```

### 4.2 Start Services

```bash
# Terminal 1 - API Server
npm run dev

# Terminal 2 - Worker
npm run dev:worker

# Terminal 3 - Keep for testing
```

### 4.3 Test New Endpoint (Stateless Mode)

**Create test file:** `test-compose.json`

```json
{
  "backgroundUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "audioUrl": "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
  "wordTimestamps": [
    { "word": "This", "start": 0.0, "end": 0.2 },
    { "word": "is", "start": 0.2, "end": 0.4 },
    { "word": "a", "start": 0.4, "end": 0.5 },
    { "word": "test", "start": 0.5, "end": 0.8 }
  ],
  "duration": 5,
  "resolution": "1080x1920"
}
```

**Note:** This will fail because we need S3 mode. Let's test with S3 configured.

### 4.4 Configure S3/R2 for Testing

**Edit `.env`:**

```bash
# Change mode
STORAGE_MODE=s3

# Add R2 credentials (get from Cloudflare dashboard)
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=easybrainrot-assets
S3_ACCESS_KEY_ID=<your_key>
S3_SECRET_ACCESS_KEY=<your_secret>
S3_PUBLIC_URL=https://assets.easybrainrot.com
```

**Restart services** (Ctrl+C in both terminals, then restart)

### 4.5 Test API Call

```bash
# Test endpoint
curl -X POST http://localhost:3000/video/compose \
  -H "Content-Type: application/json" \
  -d @test-compose.json

# Should return:
# {"url": "https://assets.easybrainrot.com/videos/...mp4"}
```

**If successful:** ✅ Your customization works!
**If failed:** See [Troubleshooting](#troubleshooting)

---

## 📤 Step 5: Push to GitHub

### 5.1 Review Changes

```bash
# See what files changed
git status

# Should show:
# - new files in src/utils/
# - modified files in src/components/video/
# - modified src/queue/processor.ts
```

### 5.2 Commit Changes

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: add video composition endpoint with captions and watermark

- Add ASS subtitle generator for karaoke-style captions
- Add watermark positioning utility (9 positions)
- Add file download utility
- Add VIDEO_COMPOSE job type to queue processor
- Add POST /video/compose endpoint
- Support S3/R2 storage output

Enables brainrot video composition:
- Background video + audio merge
- Word-level caption highlighting
- Watermark overlay
- Vertical video output (1080x1920)

Related to: EasyBrainrot Day 6 - Video Composition"
```

### 5.3 Push to GitHub

```bash
# Push feature branch to YOUR fork
git push origin feature/video-composition

# Output should show:
# To https://github.com/YOUR_USERNAME/ffmpeg-rest.git
#  * [new branch]      feature/video-composition -> feature/video-composition
```

### 5.4 Create Pull Request (Optional - For Your Records)

1. Go to your GitHub repository
2. Click "Compare & pull request"
3. **Base repository:** YOUR_USERNAME/ffmpeg-rest (not crisog's!)
4. **Base branch:** main
5. **Compare branch:** feature/video-composition
6. Add description of changes
7. Click "Create pull request"
8. **Merge** the PR into your main branch

**Or merge directly:**

```bash
# Switch to main
git checkout main

# Merge feature branch
git merge feature/video-composition

# Push updated main
git push origin main
```

---

## 🚂 Step 6: Deploy to Railway

### 6.1 Create Railway Account

1. Go to https://railway.com
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your GitHub

### 6.2 Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Search for YOUR fork: `YOUR_USERNAME/ffmpeg-rest`
4. Click on the repository
5. Railway will start deployment automatically

**Wait for deployment:** 3-5 minutes

### 6.3 Monitor Build Logs

1. Click on the service (shows as "ffmpeg-rest")
2. Go to "Deployments" tab
3. Click on the active deployment
4. Watch logs - should see:
   ```
   Building...
   Installing dependencies...
   Building TypeScript...
   Build successful
   Starting server...
   Server listening on port 3000
   ```

### 6.4 Get Railway URL

1. Go to "Settings" tab
2. Scroll to "Networking" section
3. Click "Generate Domain"
4. Copy the URL (e.g., `ffmpeg-production-a1b2.up.railway.app`)

---

## ⚙️ Step 7: Configure Environment Variables

### 7.1 Add Environment Variables in Railway

1. Go to "Variables" tab
2. Click "Raw Editor"
3. **Paste all variables:**

```bash
PORT=3000
NODE_ENV=production

# Redis (auto-provided by Railway)
REDIS_URL=${{Redis.REDIS_URL}}

# Storage mode
STORAGE_MODE=s3

# Cloudflare R2 Configuration
S3_ENDPOINT=https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=easybrainrot-assets
S3_ACCESS_KEY_ID=<your_r2_access_key_id>
S3_SECRET_ACCESS_KEY=<your_r2_secret_access_key>
S3_PUBLIC_URL=https://assets.easybrainrot.com
S3_PATH_PREFIX=

# Optional
TEMP_DIR=/tmp/ffmpeg-rest
MAX_FILE_SIZE=104857600
WORKER_CONCURRENCY=5

# Authentication (optional - for security)
# BEARER_TOKENS=easybrainrot_prod_abc123,other_project_xyz789
```

4. Click "Save"
5. **Railway will automatically redeploy** with new variables

**Get R2 credentials from Cloudflare:**
1. Go to Cloudflare dashboard → R2
2. Click on your bucket
3. Go to "Settings" → "R2 API Tokens"
4. Click "Create API Token"
5. Copy the credentials

### 7.2 Add Redis Service

1. In Railway project, click "+ New"
2. Select "Database" → "Add Redis"
3. Railway automatically links it to your service
4. The `REDIS_URL` variable is auto-populated

### 7.3 Verify Deployment

Wait for redeployment (1-2 minutes), then test:

```bash
# Replace with YOUR Railway URL
curl https://ffmpeg-production-a1b2.up.railway.app/health

# Should return: {"status":"ok"}
```

---

## 🎬 Step 8: Test Production

### 8.1 Test Video Composition Endpoint

**Create test request:**

```bash
# Replace RAILWAY_URL with your actual URL
RAILWAY_URL="https://ffmpeg-production-a1b2.up.railway.app"

curl -X POST $RAILWAY_URL/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "audioUrl": "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
    "wordTimestamps": [
      {"word": "This", "start": 0.0, "end": 0.2},
      {"word": "is", "start": 0.2, "end": 0.4},
      {"word": "a", "start": 0.4, "end": 0.5},
      {"word": "test", "start": 0.5, "end": 0.8}
    ],
    "duration": 5,
    "resolution": "1080x1920"
  }'
```

**Expected response:**

```json
{
  "url": "https://assets.easybrainrot.com/videos/abc123xyz.mp4"
}
```

### 8.2 Verify Video

1. Copy the URL from response
2. Open in browser
3. Verify:
   - ✅ Video plays
   - ✅ Audio is synced
   - ✅ Captions appear word-by-word
   - ✅ Vertical format (1080x1920)

### 8.3 Test with Watermark

**Upload watermark to R2:**
1. Create `watermark.png` (transparent PNG with "easybrainrot.com")
2. Upload to R2 bucket
3. Get public URL

**Test with watermark:**

```bash
curl -X POST $RAILWAY_URL/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "...",
    "audioUrl": "...",
    "wordTimestamps": [...],
    "duration": 5,
    "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
    "watermarkPosition": "bottom-center",
    "resolution": "1080x1920"
  }'
```

**Verify watermark appears at bottom center.**

---

## 🐛 Troubleshooting

### Issue: Build Fails with TypeScript Errors

**Error:** `Cannot find module '@/utils/ass-generator'`

**Solution:**
1. Check file paths are correct
2. Verify TypeScript paths in `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "~/*": ["./src/*"]
       }
     }
   }
   ```
3. Use relative imports if needed:
   ```typescript
   import { generateASS } from '../utils/ass-generator';
   ```

### Issue: FFmpeg Not Found

**Error:** `ffmpeg: command not found`

**Solution for Local:**
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

**Solution for Railway:**
- The Docker image should have FFmpeg pre-installed
- Check `Dockerfile` includes FFmpeg installation
- If missing, add to Dockerfile:
  ```dockerfile
  RUN apt-get update && apt-get install -y ffmpeg
  ```

### Issue: Redis Connection Failed

**Error:** `Error connecting to Redis`

**Solution Local:**
```bash
# Start Redis
docker-compose up -d

# Check if running
docker ps
```

**Solution Railway:**
- Ensure Redis service is added to project
- Check `REDIS_URL` variable is set correctly
- Should be: `${{Redis.REDIS_URL}}`

### Issue: S3/R2 Upload Failed

**Error:** `Failed to upload to S3`

**Solution:**
1. Verify R2 credentials in environment variables
2. Check bucket exists and is accessible
3. Verify endpoint URL format:
   ```
   https://<account-id>.r2.cloudflarestorage.com
   ```
4. Test credentials with AWS CLI:
   ```bash
   aws s3 ls --endpoint-url=https://... s3://bucket-name
   ```

### Issue: Video Composition Takes Too Long

**Error:** Timeout or very slow processing

**Solution:**
1. Check video file sizes (should be <200MB)
2. Verify Railway has sufficient resources:
   - Go to Settings → Resources
   - Upgrade to higher tier if needed
3. Optimize FFmpeg preset:
   - Use `preset: 'ultrafast'` for testing
   - Use `preset: 'fast'` for production

### Issue: Captions Not Showing

**Error:** Video plays but no captions visible

**Solution:**
1. Check ASS file generation:
   ```bash
   # Add logging in processor
   console.log('ASS content:', assContent);
   ```
2. Verify FFmpeg uses ASS filter correctly:
   ```
   -filter_complex "...ass=captions.ass..."
   ```
3. Check font is available in container
4. Try different font: `fontFamily: 'Arial'`

---

## ✅ Deployment Complete!

**You now have:**
- ✅ Custom FFmpeg microservice deployed on Railway
- ✅ Video composition endpoint with captions + watermark
- ✅ S3/R2 storage integration
- ✅ API accessible from anywhere

**Railway URL saved:** `https://ffmpeg-production-xxxx.up.railway.app`

**Next steps:**
1. Integrate with EasyBrainrot (Day 6 implementation)
2. Create watermark asset (easybrainrot.com logo)
3. Test end-to-end pipeline (PDF → Video)
4. Monitor Railway costs and usage

---

## 📚 Additional Resources

**Documentation:**
- Railway FFmpeg Template: https://github.com/crisog/ffmpeg-rest
- FFmpeg Documentation: https://ffmpeg.org/documentation.html
- ASS Subtitle Format: https://en.wikipedia.org/wiki/SubStation_Alpha
- Cloudflare R2 Docs: https://developers.cloudflare.com/r2/

**Cost Monitoring:**
- Railway Dashboard: https://railway.app/dashboard
- View usage under "Usage" tab
- Set budget alerts in Settings → Billing

**Support:**
- Railway Discord: https://discord.gg/railway
- FFmpeg Community: https://ffmpeg.org/contact.html

---

**Status:** ✅ Ready for Integration
**Last Updated:** November 22, 2025
**Maintained By:** EasyBrainrot Team
