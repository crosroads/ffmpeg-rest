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

  // @ts-expect-error - Type mismatch between web and node streams
  await pipeline(response.body, fileStream);
}

/**
 * Download multiple files concurrently
 */
export async function downloadFiles(downloads: { url: string; path: string }[]): Promise<void> {
  await Promise.all(downloads.map(({ url, path }) => downloadFile(url, path)));
}

/**
 * Get background video with caching
 * Downloads on first use, reuses cached file for subsequent requests
 *
 * Cache persists for container lifetime, saving 30-60s per video after first download
 */
export async function getCachedBackgroundVideo(backgroundId: string, backgroundUrl: string): Promise<string> {
  const cacheDir = '/tmp/cache/backgrounds';
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
