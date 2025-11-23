import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type {
  VideoToMp4JobData,
  VideoExtractAudioJobData,
  VideoExtractFramesJobData,
  VideoComposeJobData
} from './schemas';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, basename } from 'path';
import path from 'path';
import { env } from '~/config/env';
import { uploadToS3 } from '~/utils/storage';
import { generateASS } from '~/utils/ass-generator';
import type { WatermarkPosition } from '~/utils/watermark-positions';
import { getWatermarkPosition } from '~/utils/watermark-positions';
import { downloadFile, getCachedBackgroundVideo } from '~/utils/download';

const execFileAsync = promisify(execFile);

const PROCESSING_TIMEOUT = 600000;

async function shouldCopyStreams(inputPath: string): Promise<boolean> {
  try {
    const { stdout: videoCodec } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath
      ],
      { timeout: 30000 }
    );

    const { stdout: audioCodec } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath
      ],
      { timeout: 30000 }
    );

    return videoCodec.trim() === 'h264' && audioCodec.trim() === 'aac';
  } catch {
    return false;
  }
}

export async function processVideoToMp4(job: Job<VideoToMp4JobData>): Promise<JobResult> {
  const { inputPath, outputPath, crf, preset, smartCopy } = job.data;

  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input file does not exist: ${inputPath}`
    };
  }

  try {
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    if (smartCopy && (await shouldCopyStreams(inputPath))) {
      await execFileAsync('ffmpeg', ['-i', inputPath, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath], {
        timeout: PROCESSING_TIMEOUT
      });
    } else {
      await execFileAsync(
        'ffmpeg',
        [
          '-i',
          inputPath,
          '-codec:v',
          'libx264',
          '-preset',
          preset,
          '-crf',
          crf.toString(),
          '-codec:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          '-y',
          outputPath
        ],
        { timeout: PROCESSING_TIMEOUT }
      );
    }

    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'video/mp4', basename(outputPath));
      await rm(outputPath, { force: true });
      return {
        success: true,
        outputUrl: url
      };
    }

    return {
      success: true,
      outputPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to convert video to MP4: ${errorMessage}`
    };
  }
}

export async function processVideoExtractAudio(job: Job<VideoExtractAudioJobData>): Promise<JobResult> {
  const { inputPath, outputPath, mono } = job.data;

  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input file does not exist: ${inputPath}`
    };
  }

  try {
    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    const args = ['-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100'];

    if (mono) {
      args.push('-ac', '1');
    }

    args.push('-y', outputPath);

    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'audio/wav', basename(outputPath));
      await rm(outputPath, { force: true });
      return {
        success: true,
        outputUrl: url
      };
    }

    return {
      success: true,
      outputPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to extract audio from video: ${errorMessage}`
    };
  }
}

export async function processVideoExtractFrames(job: Job<VideoExtractFramesJobData>): Promise<JobResult> {
  const { inputPath, outputDir, fps, format, quality, compress } = job.data;

  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input file does not exist: ${inputPath}`
    };
  }

  try {
    await mkdir(outputDir, { recursive: true });

    const ext = format === 'jpg' ? 'jpg' : 'png';
    const outputPattern = path.join(outputDir, `frame_%04d.${ext}`);

    const args = ['-i', inputPath, '-vf', `fps=${fps}`];

    if (format === 'jpg' && quality) {
      args.push('-q:v', quality.toString());
    }

    args.push('-y', outputPattern);

    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    const { readdirSync } = await import('fs');
    const frames = readdirSync(outputDir)
      .filter((f) => f.endsWith(`.${ext}`))
      .map((f) => path.join(outputDir, f));

    if (frames.length === 0) {
      return {
        success: false,
        error: 'No frames were extracted from the video'
      };
    }

    if (compress === 'zip') {
      const { default: archiver } = await import('archiver');
      const { createWriteStream } = await import('fs');
      const archivePath = `${outputDir}.zip`;
      const output = createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);
      archive.directory(outputDir, false);
      await archive.finalize();

      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
      });

      if (env.STORAGE_MODE === 's3') {
        const { url } = await uploadToS3(archivePath, 'application/zip', basename(archivePath));
        await rm(dirname(outputDir), { recursive: true, force: true });
        return {
          success: true,
          outputUrl: url
        };
      }

      return {
        success: true,
        outputPath: archivePath
      };
    } else if (compress === 'gzip') {
      const tar = await import('tar');
      const archivePath = `${outputDir}.tar.gz`;

      await tar.c(
        {
          gzip: true,
          file: archivePath,
          cwd: dirname(outputDir)
        },
        [path.basename(outputDir)]
      );

      if (env.STORAGE_MODE === 's3') {
        const { url } = await uploadToS3(archivePath, 'application/gzip', basename(archivePath));
        await rm(dirname(outputDir), { recursive: true, force: true });
        return {
          success: true,
          outputUrl: url
        };
      }

      return {
        success: true,
        outputPath: archivePath
      };
    }

    return {
      success: true,
      outputPaths: frames
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to extract frames from video: ${errorMessage}`
    };
  }
}

export async function processVideoCompose(job: Job<VideoComposeJobData>): Promise<JobResult> {
  const {
    backgroundUrl,
    backgroundId,
    audioUrl,
    musicUrl,
    musicVolume = 0.25,
    wordTimestamps,
    duration,
    watermarkUrl,
    resolution,
    watermarkPosition,
    fontFamily,
    fontSize,
    primaryColor,
    highlightColor
  } = job.data;

  const jobDir = path.join(env.TEMP_DIR, job.id);

  try {
    // 1. Create temp directory
    await mkdir(jobDir, { recursive: true });

    const audioPath = path.join(jobDir, 'audio.mp3');
    const musicPath = path.join(jobDir, 'music.mp3');
    const watermarkPath = path.join(jobDir, 'watermark.png');
    const captionsPath = path.join(jobDir, 'captions.ass');
    const outputPath = path.join(jobDir, 'output.mp4');

    // 2. Generate ASS subtitle file with karaoke highlighting
    const assContent = generateASS(wordTimestamps, {
      resolution,
      fontFamily,
      fontSize,
      primaryColor,
      highlightColor
    });
    console.log('[VideoCompose] Generated ASS content:');
    console.log(assContent);
    console.log('[VideoCompose] ASS content length:', assContent.length);
    console.log('[VideoCompose] Font family:', fontFamily);
    await writeFile(captionsPath, assContent, 'utf-8');

    // 3. Get background video (cached for performance)
    const backgroundPath = await getCachedBackgroundVideo(backgroundId || 'default', backgroundUrl);

    // 4. Download audio, music (and watermark if provided)
    const downloads = [{ url: audioUrl, path: audioPath }];

    if (musicUrl) {
      downloads.push({ url: musicUrl, path: musicPath });
    }

    if (watermarkUrl) {
      downloads.push({ url: watermarkUrl, path: watermarkPath });
    }

    await Promise.all(downloads.map(({ url, path }) => downloadFile(url, path)));

    // 5. Build FFmpeg arguments
    const watermarkOverlayPos = getWatermarkPosition(watermarkPosition as WatermarkPosition);

    // Build inputs: [background, audio, music?, watermark?]
    const inputs: string[] = ['-i', backgroundPath, '-i', audioPath];

    // Track input indices (FFmpeg input numbering: 0, 1, 2, ...)
    let currentInputIndex = 2; // background=0, audio=1, next is 2
    let musicInputIndex = -1;
    let watermarkInputIndex = -1;

    if (musicUrl) {
      musicInputIndex = currentInputIndex++;
      inputs.push('-stream_loop', '-1', '-i', musicPath); // Loop music infinitely
    }

    if (watermarkUrl) {
      watermarkInputIndex = currentInputIndex++;
      inputs.push('-i', watermarkPath);
    }

    // Build filter_complex
    let filterComplex = '';

    // Audio mixing (if music provided)
    if (musicUrl) {
      // Mix TTS (100%) with music (musicVolume)
      filterComplex += `[1:a]volume=1.0[tts];`;
      filterComplex += `[${musicInputIndex}:a]volume=${musicVolume}[music];`;
      filterComplex += `[tts][music]amix=inputs=2:duration=first[audio];`;
    }

    // Video processing
    filterComplex += `[0:v]trim=duration=${duration}[bg];`;

    if (watermarkUrl) {
      filterComplex += `[bg][${watermarkInputIndex}:v]overlay=${watermarkOverlayPos}[watermarked];`;
      filterComplex += `[watermarked]ass='${captionsPath.replace(/'/g, "'\\''")}'[final]`;
    } else {
      filterComplex += `[bg]ass='${captionsPath.replace(/'/g, "'\\''")}'[final]`;
    }

    // Determine audio source
    const audioSource = musicUrl ? '[audio]' : '1:a';

    const args = [
      ...inputs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[final]',
      '-map',
      audioSource,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-r',
      '30',
      '-s',
      resolution,
      '-shortest',
      '-y',
      outputPath
    ];

    console.log('[VideoCompose] Running FFmpeg with args:', args);

    // 6. Execute FFmpeg
    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    // 7. Handle storage mode
    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`);
      await rm(jobDir, { recursive: true, force: true });

      const result = {
        success: true,
        outputUrl: url
      };

      console.log('[VideoCompose] Returning result:', JSON.stringify(result, null, 2));
      console.log('[VideoCompose] URL type:', typeof url);
      console.log('[VideoCompose] URL value:', url);

      return result;
    }

    return {
      success: true,
      outputPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VideoCompose] Error:', errorMessage);

    // Cleanup on error
    await rm(jobDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });

    return {
      success: false,
      error: `Failed to compose video: ${errorMessage}`
    };
  }
}
