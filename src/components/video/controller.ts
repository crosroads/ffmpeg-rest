import type { OpenAPIHono } from '@hono/zod-openapi';
import { videoToMp4Route, extractAudioRoute, extractFramesRoute, downloadFrameRoute } from './schemas';
import { addJob, JobType, queueEvents } from '~/queue';
import { env } from '~/config/env';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export function registerVideoRoutes(app: OpenAPIHono) {
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

      const result = await job.waitUntilFinished(queueEvents);

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

      const result = await job.waitUntilFinished(queueEvents);

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

  app.openapi(extractFramesRoute, (c) => {
    return c.json({ error: 'Not implemented yet' }, 501);
  });

  app.openapi(downloadFrameRoute, (c) => {
    return c.json({ error: 'Not implemented yet' }, 501);
  });
}
