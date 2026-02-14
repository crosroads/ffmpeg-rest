import type { OpenAPIHono } from '@hono/zod-openapi';
import {
  videoProbeRoute,
  videoToMp4Route,
  videoToMp4UrlRoute,
  extractAudioRoute,
  extractAudioUrlRoute,
  extractFramesRoute,
  extractFramesUrlRoute,
  downloadFrameRoute,
  composeVideoRoute,
  videoOverlayRoute
} from './schemas';
import { addJob, JobType, queueEvents, validateJobResult } from '~/queue';
import { env } from '~/config/env';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';

const execFileAsync = promisify(execFile);

export function registerVideoRoutes(app: OpenAPIHono) {
  // GET /video/probe — Lightweight metadata probe for remote video URLs
  // No queue needed — inline ffprobe, reads only container header (<1s)
  app.openapi(videoProbeRoute, async (c) => {
    const { url } = c.req.valid('query');

    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', url],
        { timeout: 30000 }
      );

      const probe = JSON.parse(stdout);
      const videoStream = probe.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');

      if (!videoStream) {
        return c.json({ error: 'No video stream found in the provided URL' }, 400);
      }

      const duration = parseFloat(probe.format?.duration || '0');
      if (!duration || duration <= 0) {
        return c.json({ error: 'Could not determine video duration' }, 400);
      }

      return c.json(
        {
          duration,
          width: videoStream.width,
          height: videoStream.height
        },
        200
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[VideoProbe] Error:', msg);
      return c.json({ error: `Probe failed: ${msg}` }, 500);
    }
  });

  app.openapi(videoToMp4Route, async (c) => {
    try {
      const { file } = c.req.valid('form');

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');
      const outputPath = path.join(jobDir, 'output.mp4');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_TO_MP4, {
        inputPath,
        outputPath,
        crf: 23,
        preset: 'medium',
        smartCopy: true
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputPath) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Conversion failed' }, 400);
      }

      const outputBuffer = await readFile(result.outputPath);
      await rm(jobDir, { recursive: true, force: true });

      return c.body(new Uint8Array(outputBuffer), 200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^.]+$/, '')}.mp4"`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(extractAudioRoute, async (c) => {
    try {
      const { file } = c.req.valid('form');
      const query = c.req.valid('query');
      const mono = query.mono === 'yes';

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');
      const outputPath = path.join(jobDir, 'output.wav');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_EXTRACT_AUDIO, {
        inputPath,
        outputPath,
        mono
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputPath) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Audio extraction failed' }, 400);
      }

      const outputBuffer = await readFile(result.outputPath);
      await rm(jobDir, { recursive: true, force: true });

      return c.body(new Uint8Array(outputBuffer), 200, {
        'Content-Type': 'audio/wav',
        'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^.]+$/, '')}.wav"`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(extractFramesRoute, async (c) => {
    try {
      const { file } = c.req.valid('form');
      const query = c.req.valid('query');
      const fps = query.fps || 1;
      const compress = query.compress;

      if (!compress) {
        return c.json(
          {
            error: 'compress parameter is required',
            message: 'Please specify compress=zip or compress=gzip to get frames as an archive'
          },
          400
        );
      }

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      const outputDir = path.join(jobDir, 'frames');
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_EXTRACT_FRAMES, {
        inputPath,
        outputDir,
        fps,
        format: 'png',
        compress
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputPath) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Frame extraction failed' }, 400);
      }

      const outputBuffer = await readFile(result.outputPath);
      await rm(jobDir, { recursive: true, force: true });

      const contentType = compress === 'zip' ? 'application/zip' : 'application/gzip';
      const extension = compress === 'zip' ? 'zip' : 'tar.gz';

      return c.body(new Uint8Array(outputBuffer), 200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${file.name.replace(/\.[^.]+$/, '')}_frames.${extension}"`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(videoToMp4UrlRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json({ error: 'S3 mode not enabled' }, 400);
      }

      const { file } = c.req.valid('form');

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');
      const outputPath = path.join(jobDir, 'output.mp4');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_TO_MP4, {
        inputPath,
        outputPath,
        crf: 23,
        preset: 'medium',
        smartCopy: true
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Conversion failed' }, 400);
      }

      await rm(jobDir, { recursive: true, force: true });
      return c.json({ url: result.outputUrl }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(extractAudioUrlRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json({ error: 'S3 mode not enabled' }, 400);
      }

      const { file } = c.req.valid('form');
      const query = c.req.valid('query');
      const mono = query.mono === 'yes';

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');
      const outputPath = path.join(jobDir, 'output.wav');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_EXTRACT_AUDIO, {
        inputPath,
        outputPath,
        mono
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Audio extraction failed' }, 400);
      }

      await rm(jobDir, { recursive: true, force: true });
      return c.json({ url: result.outputUrl }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(extractFramesUrlRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json({ error: 'S3 mode not enabled' }, 400);
      }

      const { file } = c.req.valid('form');
      const query = c.req.valid('query');
      const fps = query.fps || 1;
      const compress = query.compress;

      if (!compress) {
        return c.json(
          {
            error: 'compress parameter is required',
            message: 'Please specify compress=zip or compress=gzip to get frames as an archive'
          },
          400
        );
      }

      const jobId = randomUUID();
      const jobDir = path.join(env.TEMP_DIR, jobId);
      const outputDir = path.join(jobDir, 'frames');
      await mkdir(jobDir, { recursive: true });

      const inputPath = path.join(jobDir, 'input');

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));

      const job = await addJob(JobType.VIDEO_EXTRACT_FRAMES, {
        inputPath,
        outputDir,
        fps,
        format: 'png',
        compress
      });

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        await rm(jobDir, { recursive: true, force: true });
        return c.json({ error: result.error || 'Frame extraction failed' }, 400);
      }

      await rm(jobDir, { recursive: true, force: true });
      return c.json({ url: result.outputUrl }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json({ error: 'Processing failed', message: errorMessage }, 500);
    }
  });

  app.openapi(downloadFrameRoute, (c) => {
    return c.json(
      {
        error: 'Not implemented - use compress parameter on POST /video/frames instead'
      },
      501
    );
  });

  app.openapi(composeVideoRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json(
          {
            error: 'S3 mode required',
            message: 'Video composition requires STORAGE_MODE=s3 in environment variables'
          },
          400
        );
      }

      const body = c.req.valid('json');

      console.log('[VideoCompose] Received request:', {
        backgroundUrl: body.backgroundUrl,
        backgroundId: body.backgroundId,
        audioUrl: body.audioUrl,
        musicUrl: body.musicUrl,
        musicVolume: body.musicVolume,
        duration: body.duration,
        wordCount: body.wordTimestamps.length,
        resolution: body.resolution,
        hasWatermark: !!body.watermarkUrl || !!body.watermarkText,
        watermarkType: body.watermarkText ? 'text' : body.watermarkUrl ? 'image' : 'none'
      });

      // Queue the job
      const job = await addJob(JobType.VIDEO_COMPOSE, {
        backgroundUrl: body.backgroundUrl,
        backgroundId: body.backgroundId,
        audioUrl: body.audioUrl,
        musicUrl: body.musicUrl,
        musicVolume: body.musicVolume,
        wordTimestamps: body.wordTimestamps,
        duration: body.duration,
        // Text watermark parameters (recommended)
        watermarkText: body.watermarkText,
        watermarkFontFamily: body.watermarkFontFamily,
        watermarkFontSize: body.watermarkFontSize,
        watermarkFontColor: body.watermarkFontColor,
        watermarkBorderWidth: body.watermarkBorderWidth,
        watermarkBorderColor: body.watermarkBorderColor,
        watermarkShadowColor: body.watermarkShadowColor,
        watermarkShadowX: body.watermarkShadowX,
        watermarkShadowY: body.watermarkShadowY,
        // Watermark background box (for visibility on busy backgrounds)
        watermarkBoxEnabled: body.watermarkBoxEnabled,
        watermarkBoxColor: body.watermarkBoxColor,
        watermarkBoxOpacity: body.watermarkBoxOpacity,
        watermarkBoxPadding: body.watermarkBoxPadding,
        // Image watermark parameters (legacy)
        watermarkUrl: body.watermarkUrl,
        watermarkScale: body.watermarkScale,
        // Common watermark settings
        watermarkOpacity: body.watermarkOpacity,
        watermarkPosition: body.watermarkPosition,
        watermarkPadding: body.watermarkPadding,
        resolution: body.resolution,
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        primaryColor: body.primaryColor,
        highlightColor: body.highlightColor,
        marginBottom: body.marginBottom,
        // Multi-project bucket organization
        pathPrefix: body.pathPrefix,
        publicUrl: body.publicUrl
      });

      console.log(`[VideoCompose] Job queued: ${job.id}`);

      // Wait for completion
      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        console.error('[VideoCompose] Job failed:', result.error);
        return c.json(
          {
            error: result.error || 'Video composition failed'
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
          message: errorMessage
        },
        500
      );
    }
  });

  app.openapi(videoOverlayRoute, async (c) => {
    try {
      if (env.STORAGE_MODE !== 's3') {
        return c.json(
          {
            error: 'S3 mode required',
            message: 'Video overlay requires STORAGE_MODE=s3 in environment variables'
          },
          400
        );
      }

      const body = c.req.valid('json');

      if (!body.overlayAsset && !body.overlayUrl) {
        return c.json(
          {
            error: 'Either overlayAsset or overlayUrl must be provided'
          },
          400
        );
      }

      console.log('[VideoOverlay] Received request:', {
        videoUrl: body.videoUrl,
        overlayAsset: body.overlayAsset,
        overlayUrl: body.overlayUrl,
        overlayPosition: body.overlayPosition,
        overlayScale: body.overlayScale,
        pathPrefix: body.pathPrefix
      });

      const job = await addJob(JobType.VIDEO_OVERLAY, {
        videoUrl: body.videoUrl,
        overlayAsset: body.overlayAsset,
        overlayUrl: body.overlayUrl,
        overlayPosition: body.overlayPosition,
        overlayScale: body.overlayScale,
        overlayMarginX: body.overlayMarginX,
        overlayMarginY: body.overlayMarginY,
        pathPrefix: body.pathPrefix,
        publicUrl: body.publicUrl
      });

      console.log(`[VideoOverlay] Job queued: ${job.id}`);

      const rawResult = await job.waitUntilFinished(queueEvents);
      const result = validateJobResult(rawResult);

      if (!result.success || !result.outputUrl) {
        console.error('[VideoOverlay] Job failed:', result.error);
        return c.json(
          {
            error: result.error || 'Video overlay failed'
          },
          400
        );
      }

      console.log(`[VideoOverlay] Job complete: ${result.outputUrl}`);

      return c.json({ url: result.outputUrl }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[VideoOverlay] Error:', errorMessage);

      return c.json(
        {
          error: 'Processing failed',
          message: errorMessage
        },
        500
      );
    }
  });
}
