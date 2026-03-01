import type { Job } from 'bullmq';
import type { JobResult } from '..';
import type {
  VideoToMp4JobData,
  VideoExtractAudioJobData,
  VideoExtractFramesJobData,
  VideoComposeJobData,
  VideoOverlayJobData,
  VideoMergeAudioJobData,
  VideoMergeJobData
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
import type { OverlayPosition } from '~/utils/overlay-positions';
import { getOverlayPosition } from '~/utils/overlay-positions';
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

/**
 * Convert hex color to FFmpeg color format with opacity
 * @param hexColor - Hex color like "#FFFFFF"
 * @param opacity - Opacity 0.0-1.0
 * @returns FFmpeg color string like "0xFFFFFFD9" (RRGGBBAA format)
 */
function hexToFFmpegColor(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // FFmpeg uses 0x format with alpha (00 = transparent, FF = opaque)
  const alphaHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');

  return `0x${hex}${alphaHex}`;
}

/**
 * Get drawtext position coordinates from watermarkPosition
 * @param position - Position name (e.g., "bottom-center")
 * @param padding - Padding from edges in pixels (default: 475)
 * @returns Object with x and y coordinate expressions for FFmpeg drawtext
 */
function getDrawtextPosition(position: WatermarkPosition, padding = 475): { x: string; y: string } {
  const positions: Record<WatermarkPosition, { x: string; y: string }> = {
    'top-left': { x: `${padding}`, y: `${padding}` },
    'top-center': { x: '(w-text_w)/2', y: `${padding}` },
    'top-right': { x: `w-text_w-${padding}`, y: `${padding}` },

    'middle-left': { x: `${padding}`, y: '(h-text_h)/2' },
    'middle-center': { x: '(w-text_w)/2', y: '(h-text_h)/2' },
    'middle-right': { x: `w-text_w-${padding}`, y: '(h-text_h)/2' },

    'bottom-left': { x: `${padding}`, y: `h-text_h-${padding}` },
    'bottom-center': { x: '(w-text_w)/2', y: `h-text_h-${padding}` },
    'bottom-right': { x: `w-text_w-${padding}`, y: `h-text_h-${padding}` }
  };

  return positions[position];
}

export async function processVideoCompose(job: Job<VideoComposeJobData>): Promise<JobResult> {
  const {
    backgroundUrl,
    backgroundId,
    audioUrl,
    musicUrl,
    musicVolume = 0.4,
    wordTimestamps,
    duration,
    // Text watermark (priority)
    watermarkText,
    watermarkFontFamily = 'Liberation-Sans-Bold',
    watermarkFontSize = 48,
    watermarkFontColor = '#FFFFFF',
    watermarkBorderWidth = 2,
    watermarkBorderColor = '#000000',
    watermarkShadowColor = '#000000',
    watermarkShadowX = 2,
    watermarkShadowY = 2,
    // Watermark background box (for visibility on busy backgrounds)
    watermarkBoxEnabled = false,
    watermarkBoxColor = '#000000',
    watermarkBoxOpacity = 0.3,
    watermarkBoxPadding = 6,
    // Image watermark (legacy fallback)
    watermarkUrl,
    watermarkScale = 0.35, // 35% of video width (aggressive for viral marketing)
    // Common watermark settings
    watermarkOpacity = 0.85, // 85% opacity (prominent but not obnoxious)
    resolution,
    watermarkPosition,
    watermarkPadding = 475,
    // Caption settings
    fontFamily,
    fontSize,
    primaryColor,
    highlightColor,
    marginBottom,
    // S3 path prefix for multi-project support
    pathPrefix,
    // Public CDN URL for constructing final video URL
    publicUrl
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
      highlightColor,
      marginBottom
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

    // Video processing - Scale to cover target dimensions, crop to exact size, then trim
    // Uses force_original_aspect_ratio=increase to handle any input aspect ratio
    // This ensures narrow portrait videos (e.g., 606x1080) scale correctly for 1080x1920 output
    const [targetWidth, targetHeight] = resolution.split('x').map(Number);
    filterComplex += `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;

    // Determine watermark type: text (priority) or image (fallback)
    const useTextWatermark = !!watermarkText;
    const useImageWatermark = !useTextWatermark && !!watermarkUrl;

    if (useTextWatermark) {
      // TEXT WATERMARK: Use drawtext filter
      const textPosition = getDrawtextPosition(watermarkPosition as WatermarkPosition, watermarkPadding);
      const fontColor = hexToFFmpegColor(watermarkFontColor, watermarkOpacity);
      const borderColor = hexToFFmpegColor(watermarkBorderColor, watermarkOpacity);
      const shadowColor = hexToFFmpegColor(watermarkShadowColor, watermarkOpacity);

      // Escape text for FFmpeg (escape single quotes and colons)
      const escapedText = watermarkText.replace(/'/g, "'\\''").replace(/:/g, '\\:');

      // Build drawtext filter with fontfile parameter using fontconfig syntax
      // fontconfig syntax: "FontFamily:style=Style" (e.g., "Liberation Sans:style=Bold")
      // Extract font family and style from watermarkFontFamily
      let fontFamily = 'Liberation Sans';
      let fontStyle = 'Bold';

      if (watermarkFontFamily.includes('-')) {
        const parts = watermarkFontFamily.split('-');
        // "Liberation-Sans-Bold" -> family="Liberation Sans", style="Bold"
        if (parts.length >= 3) {
          fontFamily = `${parts[0]} ${parts[1]}`;
          fontStyle = parts.slice(2).join(' ');
        } else if (parts.length === 2) {
          fontFamily = parts[0].replace(/([A-Z])/g, ' $1').trim();
          fontStyle = parts[1];
        }
      }

      // Use fontfile parameter with fontconfig syntax (colons need to be escaped)
      let drawtextFilter = `drawtext=fontfile='${fontFamily}\\:style=${fontStyle}':text='${escapedText}':fontsize=${watermarkFontSize}:fontcolor=${fontColor}:borderw=${watermarkBorderWidth}:bordercolor=${borderColor}:shadowcolor=${shadowColor}:shadowx=${watermarkShadowX}:shadowy=${watermarkShadowY}:x=${textPosition.x}:y=${textPosition.y}`;

      // Add background box if enabled (for visibility on busy backgrounds)
      if (watermarkBoxEnabled) {
        const boxColor = hexToFFmpegColor(watermarkBoxColor, watermarkBoxOpacity);
        drawtextFilter += `:box=1:boxcolor=${boxColor}:boxborderw=${watermarkBoxPadding}`;
        console.log('[VideoCompose] Watermark box enabled:', {
          color: watermarkBoxColor,
          opacity: watermarkBoxOpacity,
          padding: watermarkBoxPadding,
          ffmpegBoxColor: boxColor
        });
      }

      console.log('[VideoCompose] Drawtext filter:', drawtextFilter);

      // Apply drawtext after captions (if captions exist)
      if (wordTimestamps.length > 0) {
        filterComplex += `[bg]ass='${captionsPath.replace(/'/g, "'\\''")}'[captioned];`;
        filterComplex += `[captioned]${drawtextFilter}[final]`;
      } else {
        // No captions, apply watermark directly to background
        filterComplex += `[bg]${drawtextFilter}[final]`;
      }

      console.log('[VideoCompose] Using text watermark:', {
        text: watermarkText,
        font: watermarkFontFamily,
        size: watermarkFontSize,
        color: watermarkFontColor,
        opacity: watermarkOpacity,
        position: watermarkPosition
      });
    } else if (useImageWatermark) {
      // IMAGE WATERMARK: Use overlay filter (existing logic)
      const [videoWidth] = resolution.split('x').map(Number);
      const scaledWidth = Math.round(videoWidth * watermarkScale);

      // Apply watermark scaling and opacity:
      // 1. Scale watermark to specified percentage of video width, maintain aspect ratio
      // 2. Convert to yuva420p format (enables alpha channel for transparency)
      // 3. Apply opacity using colorchannelmixer (aa = alpha adjustment)
      filterComplex += `[${watermarkInputIndex}:v]scale=${scaledWidth}:-1,format=yuva420p,colorchannelmixer=aa=${watermarkOpacity}[logo];`;
      filterComplex += `[bg][logo]overlay=${watermarkOverlayPos}[watermarked];`;
      filterComplex += `[watermarked]ass='${captionsPath.replace(/'/g, "'\\''")}'[final]`;

      console.log('[VideoCompose] Using image watermark:', {
        url: watermarkUrl,
        scale: watermarkScale,
        opacity: watermarkOpacity,
        position: watermarkPosition
      });
    } else {
      // NO WATERMARK: Just apply captions
      filterComplex += `[bg]ass='${captionsPath.replace(/'/g, "'\\''")}'[final]`;
      console.log('[VideoCompose] No watermark provided');
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
      // Pass pathPrefix and publicUrl from request to support multi-project bucket structure
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`, pathPrefix, publicUrl);
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

const OVERLAYS_DIR = path.resolve(process.cwd(), 'assets/overlays');

export async function processVideoOverlay(job: Job<VideoOverlayJobData>): Promise<JobResult> {
  const {
    videoUrl,
    overlayAsset,
    overlayUrl,
    overlayPosition = 'top-right',
    overlayScale = 0.22,
    overlayMarginX = 20,
    overlayMarginY = 20,
    pathPrefix,
    publicUrl
  } = job.data;

  const jobDir = path.join(env.TEMP_DIR, job.id);

  try {
    await mkdir(jobDir, { recursive: true });

    const videoPath = path.join(jobDir, 'input.mp4');
    const overlayPath = path.join(jobDir, 'overlay.png');
    const outputPath = path.join(jobDir, 'output.mp4');

    // 1. Download video
    console.log(`[VideoOverlay] Downloading video: ${videoUrl}`);
    await downloadFile(videoUrl, videoPath);

    // 2. Resolve overlay PNG: bundled asset (priority) or remote URL
    if (overlayAsset) {
      const assetPath = path.join(OVERLAYS_DIR, `${overlayAsset}.png`);
      if (!existsSync(assetPath)) {
        return {
          success: false,
          error: `Overlay asset not found: ${overlayAsset} (looked in ${OVERLAYS_DIR})`
        };
      }
      // Copy bundled asset to job directory
      const { copyFile } = await import('fs/promises');
      await copyFile(assetPath, overlayPath);
      console.log(`[VideoOverlay] Using bundled asset: ${overlayAsset}`);
    } else if (overlayUrl) {
      console.log(`[VideoOverlay] Downloading overlay: ${overlayUrl}`);
      await downloadFile(overlayUrl, overlayPath);
    } else {
      return {
        success: false,
        error: 'Either overlayAsset or overlayUrl must be provided'
      };
    }

    // 3. Probe video dimensions for proportional overlay scaling
    const { stdout: probeOut } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      videoPath
    ]);
    const [videoWidth, videoHeight] = probeOut.trim().split(',').map(Number);
    console.log(`[VideoOverlay] Video: ${videoWidth}x${videoHeight}`);

    // Calculate overlay pixel dimensions (overlayScale = fraction of video width)
    const { stdout: overlayProbe } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      overlayPath
    ]);
    const [ovlWidth, ovlHeight] = overlayProbe.trim().split(',').map(Number);
    const targetWidth = Math.round(videoWidth * overlayScale);
    const targetHeight = Math.round((targetWidth * ovlHeight) / ovlWidth);
    console.log(`[VideoOverlay] Overlay: ${ovlWidth}x${ovlHeight} → ${targetWidth}x${targetHeight}`);

    // Build FFmpeg filter_complex (regular scale, not deprecated scale2ref)
    const position = getOverlayPosition(overlayPosition as OverlayPosition, overlayMarginX, overlayMarginY);
    const filterComplex = `[1:v]scale=${targetWidth}:${targetHeight}[ovl];[0:v][ovl]overlay=${position}`;

    console.log(`[VideoOverlay] Filter: ${filterComplex}`);

    // 4. Execute FFmpeg
    const args = [
      '-i',
      videoPath,
      '-i',
      overlayPath,
      '-filter_complex',
      filterComplex,
      '-c:a',
      'copy',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-y',
      outputPath
    ];

    console.log('[VideoOverlay] Running FFmpeg with args:', args);
    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    // 5. Upload to S3/R2
    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`, pathPrefix, publicUrl);
      await rm(jobDir, { recursive: true, force: true });

      console.log(`[VideoOverlay] Complete: ${url}`);
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
    console.error('[VideoOverlay] Error:', errorMessage);

    await rm(jobDir, { recursive: true, force: true }).catch(() => {
      /* cleanup best-effort */
    });

    return {
      success: false,
      error: `Failed to overlay video: ${errorMessage}`
    };
  }
}

export async function processVideoMerge(job: Job<VideoMergeJobData>): Promise<JobResult> {
  const { videos, transition, transitionDuration, resolution, pathPrefix, publicUrl } = job.data;

  const jobDir = path.join(env.TEMP_DIR, job.id);

  try {
    await mkdir(jobDir, { recursive: true });

    const outputPath = path.join(jobDir, 'output.mp4');
    const [targetWidth, targetHeight] = resolution.split('x').map(Number);

    // 1. Download all input videos in parallel
    console.log(`[VideoMerge] Downloading ${videos.length} videos...`);
    const inputPaths: string[] = [];
    await Promise.all(
      videos.map(async (video, i) => {
        const inputPath = path.join(jobDir, `input_${i}.mp4`);
        await downloadFile(video.url, inputPath);
        inputPaths.push(inputPath);
      })
    );

    // Sort by index to preserve order (Promise.all may resolve out of order)
    inputPaths.sort((a, b) => {
      const aIdx = parseInt(a.match(/input_(\d+)/)?.[1] || '0');
      const bIdx = parseInt(b.match(/input_(\d+)/)?.[1] || '0');
      return aIdx - bIdx;
    });

    // 2. Probe each video for duration (needed for xfade offset calculation)
    const durations: number[] = [];
    for (let i = 0; i < inputPaths.length; i++) {
      const trim = videos[i].trim;
      const { stdout: durationOut } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPaths[i]],
        { timeout: 30000 }
      );
      const fullDuration = parseFloat(durationOut.trim()) || 0;

      // Calculate effective duration after trim
      const start = trim?.start || 0;
      const end = trim?.end || fullDuration;
      const effectiveDuration = Math.min(end, fullDuration) - start;
      durations.push(effectiveDuration);

      console.log(
        `[VideoMerge] Video ${i}: ${effectiveDuration.toFixed(2)}s (full: ${fullDuration.toFixed(2)}s, trim: ${start}-${end})`
      );
    }

    // 3. Build FFmpeg command based on transition type
    let args: string[];

    if (transition === 'none') {
      // Hard cut mode: use concat demuxer (fastest, no re-encode if codecs match)
      // But we need to normalize resolution, so we use filter_complex concat instead
      const inputs: string[] = [];
      const filterParts: string[] = [];

      for (let i = 0; i < inputPaths.length; i++) {
        const trim = videos[i].trim;
        if (trim?.start !== undefined || trim?.end !== undefined) {
          const ssArgs = trim.start ? ['-ss', trim.start.toString()] : [];
          const toArgs = trim.end ? ['-to', trim.end.toString()] : [];
          inputs.push(...ssArgs, ...toArgs, '-i', inputPaths[i]);
        } else {
          inputs.push('-i', inputPaths[i]);
        }
        filterParts.push(
          `[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2[v${i}];`
        );
        filterParts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}];`);
      }

      const videoConcat = inputPaths.map((_, i) => `[v${i}]`).join('');
      const audioConcat = inputPaths.map((_, i) => `[a${i}]`).join('');
      filterParts.push(`${videoConcat}concat=n=${inputPaths.length}:v=1:a=0[vout];`);
      filterParts.push(`${audioConcat}concat=n=${inputPaths.length}:v=0:a=1[aout]`);

      const filterComplex = filterParts.join('\n');

      args = [
        ...inputs,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-map',
        '[aout]',
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
        '-y',
        outputPath
      ];
    } else {
      // Transition mode: use xfade filter chain
      const inputs: string[] = [];

      for (let i = 0; i < inputPaths.length; i++) {
        const trim = videos[i].trim;
        if (trim?.start !== undefined || trim?.end !== undefined) {
          const ssArgs = trim.start ? ['-ss', trim.start.toString()] : [];
          const toArgs = trim.end ? ['-to', trim.end.toString()] : [];
          inputs.push(...ssArgs, ...toArgs, '-i', inputPaths[i]);
        } else {
          inputs.push('-i', inputPaths[i]);
        }
      }

      // Map transition type to FFmpeg xfade name
      const xfadeTransition = transition === 'crossfade' ? 'fade' : 'fade';

      // Build xfade filter chain
      const filterParts: string[] = [];

      // First: scale all inputs to target resolution + force constant frame rate (required by xfade)
      // setpts before fps ensures clean PTS, then fps forces CFR, then settb normalizes timebase
      for (let i = 0; i < inputPaths.length; i++) {
        filterParts.push(
          `[${i}:v]setpts=PTS-STARTPTS,scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=24,settb=AVTB[v${i}];`
        );
        filterParts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}];`);
      }

      // Build chained xfade for video
      let cumulativeOffset = 0;
      let lastVideoLabel = 'v0';
      for (let i = 1; i < inputPaths.length; i++) {
        cumulativeOffset += durations[i - 1] - transitionDuration;
        const outputLabel = i === inputPaths.length - 1 ? 'vout' : `xv${i}`;
        filterParts.push(
          `[${lastVideoLabel}][v${i}]xfade=transition=${xfadeTransition}:duration=${transitionDuration}:offset=${cumulativeOffset.toFixed(3)}[${outputLabel}];`
        );
        lastVideoLabel = outputLabel;
      }

      // Build chained acrossfade for audio
      let lastAudioLabel = 'a0';
      for (let i = 1; i < inputPaths.length; i++) {
        const outputLabel = i === inputPaths.length - 1 ? 'aout' : `xa${i}`;
        filterParts.push(`[${lastAudioLabel}][a${i}]acrossfade=d=${transitionDuration}[${outputLabel}];`);
        lastAudioLabel = outputLabel;
      }

      // Remove trailing semicolon from last filter
      const filterComplex = filterParts.join('\n').replace(/;\s*$/, '');

      args = [
        ...inputs,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-map',
        '[aout]',
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
        '-y',
        outputPath
      ];
    }

    console.log('[VideoMerge] Running FFmpeg with args:', args);

    // 4. Execute FFmpeg
    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    // 5. Probe output duration
    let outputDuration = 0;
    try {
      const { stdout: durationOut } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath],
        { timeout: 30000 }
      );
      outputDuration = parseFloat(durationOut.trim()) || 0;
    } catch {
      console.warn('[VideoMerge] Could not probe output duration');
    }

    // 6. Upload to S3
    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`, pathPrefix, publicUrl);
      await rm(jobDir, { recursive: true, force: true });

      console.log(`[VideoMerge] Complete: ${url}, duration: ${outputDuration}s`);
      return {
        success: true,
        outputUrl: url,
        metadata: { duration: outputDuration, videoCount: videos.length }
      };
    }

    return {
      success: true,
      outputPath,
      metadata: { duration: outputDuration, videoCount: videos.length }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VideoMerge] Error:', errorMessage);

    await rm(jobDir, { recursive: true, force: true }).catch(() => {
      /* cleanup best-effort */
    });

    return {
      success: false,
      error: `Failed to merge videos: ${errorMessage}`
    };
  }
}

export async function processVideoMergeAudio(job: Job<VideoMergeAudioJobData>): Promise<JobResult> {
  const { videoUrl, audioUrl, mode, volume, pathPrefix, publicUrl } = job.data;

  const jobDir = path.join(env.TEMP_DIR, job.id);

  try {
    await mkdir(jobDir, { recursive: true });

    const videoPath = path.join(jobDir, 'input.mp4');
    const audioPath = path.join(jobDir, 'audio.mp3');
    const outputPath = path.join(jobDir, 'output.mp4');

    // 1. Download video + audio in parallel
    console.log(`[VideoMergeAudio] Downloading video: ${videoUrl}`);
    console.log(`[VideoMergeAudio] Downloading audio: ${audioUrl}`);
    await Promise.all([downloadFile(videoUrl, videoPath), downloadFile(audioUrl, audioPath)]);

    // 2. Probe video codec
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
        videoPath
      ],
      { timeout: 30000 }
    );

    const codec = videoCodec.trim().toLowerCase();
    const canCopyVideo = codec === 'h264' || codec === 'hevc' || codec === 'h265';
    const videoCodecArgs = canCopyVideo ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23'];

    console.log(`[VideoMergeAudio] Video codec: ${codec}, copy: ${canCopyVideo}`);

    // 3. Check if source video has audio (needed for mix mode fallback)
    let hasAudioStream = false;
    try {
      const { stdout: audioCodecOut } = await execFileAsync(
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
          videoPath
        ],
        { timeout: 30000 }
      );
      hasAudioStream = audioCodecOut.trim().length > 0;
    } catch {
      hasAudioStream = false;
    }

    // 4. Determine merge strategy
    let effectiveMode = mode;
    if (mode === 'mix' && !hasAudioStream) {
      console.log('[VideoMergeAudio] Source video has no audio stream, falling back to replace mode');
      effectiveMode = 'replace';
    }

    // 5. Build FFmpeg args
    let args: string[];

    if (effectiveMode === 'replace') {
      // Replace mode: discard video's original audio, use new audio track
      args = [
        '-i',
        videoPath,
        '-i',
        audioPath,
        ...videoCodecArgs,
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-map',
        '0:v:0',
        '-map',
        '1:a:0'
      ];

      // Apply volume if not 1.0
      if (volume !== 1.0) {
        args = [
          '-i',
          videoPath,
          '-i',
          audioPath,
          ...videoCodecArgs,
          '-filter_complex',
          `[1:a]volume=${volume}[audio]`,
          '-map',
          '0:v:0',
          '-map',
          '[audio]',
          '-c:a',
          'aac',
          '-b:a',
          '192k'
        ];
      }

      args.push('-shortest', '-y', outputPath);
    } else {
      // Mix mode: overlay new audio on existing
      args = [
        '-i',
        videoPath,
        '-i',
        audioPath,
        ...videoCodecArgs,
        '-filter_complex',
        `[1:a]volume=${volume}[new];[0:a][new]amix=inputs=2:duration=first[out]`,
        '-map',
        '0:v:0',
        '-map',
        '[out]',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        '-y',
        outputPath
      ];
    }

    console.log(`[VideoMergeAudio] Mode: ${effectiveMode}, Volume: ${volume}`);
    console.log('[VideoMergeAudio] FFmpeg args:', args);

    // 6. Execute FFmpeg
    await execFileAsync('ffmpeg', args, { timeout: PROCESSING_TIMEOUT });

    // 7. Probe output duration
    let duration = 0;
    try {
      const { stdout: durationOut } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath],
        { timeout: 30000 }
      );
      duration = parseFloat(durationOut.trim()) || 0;
    } catch {
      console.warn('[VideoMergeAudio] Could not probe output duration');
    }

    // 8. Upload to S3
    if (env.STORAGE_MODE === 's3') {
      const { url } = await uploadToS3(outputPath, 'video/mp4', `${job.id}.mp4`, pathPrefix, publicUrl);
      await rm(jobDir, { recursive: true, force: true });

      console.log(`[VideoMergeAudio] Complete: ${url}, duration: ${duration}s`);
      return {
        success: true,
        outputUrl: url,
        metadata: { duration }
      };
    }

    return {
      success: true,
      outputPath,
      metadata: { duration }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VideoMergeAudio] Error:', errorMessage);

    await rm(jobDir, { recursive: true, force: true }).catch(() => {
      /* cleanup best-effort */
    });

    return {
      success: false,
      error: `Failed to merge audio with video: ${errorMessage}`
    };
  }
}
