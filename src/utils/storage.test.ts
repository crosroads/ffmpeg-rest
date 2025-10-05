import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { LocalstackContainer, type StartedLocalStackContainer } from '@testcontainers/localstack';
import { S3Client, CreateBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';

const TEST_DIR = path.join(process.cwd(), 'test-outputs', 'storage');
const TEST_BUCKET = 'test-ffmpeg-bucket';

describe('Storage Utility', () => {
  let container: StartedLocalStackContainer;
  let s3Client: S3Client;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };

    container = await new LocalstackContainer('localstack/localstack:latest').start();

    const endpoint = container.getConnectionUri();

    s3Client = new S3Client({
      endpoint,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });

    await s3Client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));

    process.env['STORAGE_MODE'] = 's3';
    process.env['S3_ENDPOINT'] = endpoint;
    process.env['S3_REGION'] = 'us-east-1';
    process.env['S3_BUCKET'] = TEST_BUCKET;
    process.env['S3_ACCESS_KEY_ID'] = 'test';
    process.env['S3_SECRET_ACCESS_KEY'] = 'test';
    process.env['S3_PATH_PREFIX'] = 'test-prefix';

    vi.resetModules();

    await mkdir(TEST_DIR, { recursive: true });
  }, 60000);

  afterAll(async () => {
    await container?.stop();

    process.env = originalEnv;
    vi.resetModules();

    if (TEST_DIR) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should upload file to S3 and return URL', async () => {
    const { uploadToS3 } = await import('./storage');

    const testFilePath = path.join(TEST_DIR, 'test-file.txt');
    await writeFile(testFilePath, 'test content');

    const result = await uploadToS3(testFilePath, 'text/plain', 'uploaded-file.txt');

    expect(result.url).toBeDefined();
    expect(result.key).toContain('test-prefix/');
    expect(result.key).toContain('/uploaded-file.txt');

    const headCommand = new HeadObjectCommand({
      Bucket: TEST_BUCKET,
      Key: result.key
    });

    const headResult = await s3Client.send(headCommand);
    expect(headResult.ContentType).toBe('text/plain');
  });

  it('should throw error when S3 mode not enabled', async () => {
    process.env['STORAGE_MODE'] = 'stateless';
    vi.resetModules();
    const { uploadToS3 } = await import('./storage');

    const testFilePath = path.join(TEST_DIR, 'test-file-2.txt');
    await writeFile(testFilePath, 'test content');

    await expect(uploadToS3(testFilePath, 'text/plain', 'file.txt')).rejects.toThrow('S3 mode not enabled');

    process.env['STORAGE_MODE'] = 's3';
    vi.resetModules();
  });

  it('should use custom public URL when provided', async () => {
    process.env['S3_PUBLIC_URL'] = 'https://cdn.example.com';
    vi.resetModules();
    const { uploadToS3 } = await import('./storage');

    const testFilePath = path.join(TEST_DIR, 'test-file-3.txt');
    await writeFile(testFilePath, 'test content');

    const result = await uploadToS3(testFilePath, 'text/plain', 'custom-url-file.txt');

    expect(result.url).toContain('https://cdn.example.com');
    expect(result.url).toContain(result.key);

    delete process.env['S3_PUBLIC_URL'];
    vi.resetModules();
  });
});
