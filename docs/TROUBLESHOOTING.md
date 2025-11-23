# Troubleshooting Guide

**FFmpeg REST API - Common Issues & Solutions**

**Date:** November 23, 2025
**Based on:** Day 6 Production Deployment Experience

---

## Table of Contents

1. [Caption Issues](#caption-issues)
2. [Video Composition Issues](#video-composition-issues)
3. [Deployment Issues](#deployment-issues)
4. [Performance Issues](#performance-issues)
5. [Storage Issues](#storage-issues)
6. [Development Issues](#development-issues)

---

## Caption Issues

### Issue 1: No Captions Visible

**Symptom:**
- Video generates successfully
- Audio and watermark work
- **But captions are completely invisible**

**Root Cause:**
Alpine Linux Docker image lacks fonts by default

**How to Diagnose:**
```bash
# Inside container
fc-list | grep -i liberation
# If empty, fonts not installed
```

**Solution:**
Update `Dockerfile`:

```dockerfile
# Install fonts BEFORE copying FFmpeg libraries
# Order matters - apk breaks if run after binary copy
RUN apk add --no-cache \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    && fc-cache -f

# Now copy FFmpeg binaries
COPY --from=ffmpeg /bin/ffmpeg /bin/ffmpeg
COPY --from=ffmpeg /bin/ffprobe /bin/ffprobe
COPY --from=ffmpeg /lib /lib
```

**Why This Works:**
- `fontconfig`: Font configuration system
- `ttf-liberation`: Liberation Sans (Arial-compatible)
- `ttf-dejavu`: DejaVu Sans (Unicode fallback)
- `fc-cache -f`: Builds font cache for FFmpeg

**Prevention:**
- Always install fonts in Docker Alpine images
- Verify with `fc-list` before deploying

---

### Issue 2: Overlapping Caption Text

**Symptom:**
- Multiple caption phrases display simultaneously
- "Full cap it's" AND "cap it's fake" both visible
- Screen looks cluttered with text stacking

**Root Cause:**
Created separate dialogue events per word with overlapping timestamps

**Wrong Implementation:**
```typescript
// ❌ WRONG: Per-word dialogues
timestamps.forEach((word, index) => {
  const prevWord = index > 0 ? timestamps[index - 1].word : '';
  const nextWord = index < timestamps.length - 1 ? timestamps[index + 1].word : '';

  // This creates overlapping dialogues!
  const text = `${prevWord} {\\c&GOLD&}${word.word}{\\c} ${nextWord}`;
  ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
});
```

**Why It Fails:**
- Creates N dialogues for N words
- All dialogues render if timestamps overlap
- ASS renderers show ALL active dialogues
- Result: Visual mess with stacked text

**Correct Implementation:**
Use phrase segmentation with inline animations:

```typescript
// ✅ CORRECT: Phrase-based dialogues
const segments = segmentWords(timestamps, 3);

segments.forEach(segment => {
  const textWithAnimations = segment.words
    .map((wordInfo, wordIndex) => {
      const highlightStartMs = Math.round(wordInfo.start * 1000 - dialogueStartMs);
      const highlightEndMs = Math.round(wordInfo.end * 1000 - dialogueStartMs);

      const animationTag = wordIndex === 0
        ? `{\\1c${highlightColor}&\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`
        : `{\\1c${primaryColor}&\\t(${highlightStartMs},${highlightStartMs},\\1c${highlightColor}&)\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`;

      return `${animationTag}${wordInfo.word}`;
    })
    .join(' ');

  ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${textWithAnimations}\n`;
});
```

**Why This Works:**
- Groups 2-3 words per dialogue
- Uses inline `\t` tags for color animations
- Only ONE dialogue visible at a time
- No overlapping timestamps

**See Also:**
- [CAPTION-SYSTEM.md - Phrase Segmentation](./CAPTION-SYSTEM.md#phrase-segmentation)

---

### Issue 3: Gold Highlighting Not Working

**Symptom:**
- Captions appear correctly
- Text is visible and positioned properly
- **But words remain white - no gold highlighting**

**Root Cause:**
Used absolute timestamps instead of relative to dialogue start

**Wrong Implementation:**
```typescript
// ❌ WRONG: Absolute timing
const highlightStartMs = Math.round(word.start * 1000); // 4602ms
// Result: \t(4602,4602,\1c&GOLD&) - doesn't work!
```

**Why It Fails:**
- ASS `\t` tags use timing **relative to dialogue start**
- If dialogue starts at 4.362s and word starts at 4.602s:
  - Absolute: 4602ms (wrong)
  - Relative: 240ms (correct)
- FFmpeg ignores animations with incorrect timing

**Correct Implementation:**
```typescript
// ✅ CORRECT: Relative timing
const dialogueStartMs = segment.startTime * 1000; // 4362ms
const highlightStartMs = Math.round(word.start * 1000 - dialogueStartMs); // 240ms
// Result: \t(240,240,\1c&GOLD&) - works!
```

**Debugging:**
```typescript
console.log('Dialogue start (absolute):', segment.startTime * 1000, 'ms');
console.log('Word start (absolute):', word.start * 1000, 'ms');
console.log('Word start (relative):', highlightStartMs, 'ms'); // Should be < 3000ms
```

**Reference:**
- [Aegisub Documentation](https://aegisub.org/docs/latest/ass_tags/): "times are relative to start time of subtitle"

**See Also:**
- [CAPTION-SYSTEM.md - Timing Calculations](./CAPTION-SYSTEM.md#timing-calculations)

---

### Issue 4: White Flash on First Word

**Symptom:**
- Phrase appears on screen
- First word flashes white briefly
- Then turns gold (as expected)
- Other words highlight correctly

**Root Cause:**
Animation at 0ms competing with initial render (race condition)

**Wrong Implementation:**
```typescript
// ❌ WRONG: Animation at 0ms for first word
const animationTag = `{\\1c&WHITE&\\t(0,0,\\1c&GOLD&)\\t(200,200,\\1c&WHITE&)}Full`;
// Initial render: WHITE + animation at 0ms = race condition
```

**Why It Fails:**
- Renderer initializes word as WHITE
- Animation at 0ms tries to change to GOLD
- Race condition: which happens first?
- Visual result: Brief white flash before gold

**Correct Implementation:**
```typescript
// ✅ CORRECT: First word starts gold
const animationTag = wordIndex === 0
  ? `{\\1c${highlightColor}&\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}` // Start gold
  : `{\\1c${primaryColor}&\\t(${highlightStartMs},${highlightStartMs},\\1c${highlightColor}&)\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`; // Start white
```

**Why This Works:**
- First word: Initialized as GOLD (no 0ms animation)
- Subsequent words: WHITE → GOLD → WHITE
- No race condition
- Smooth visual appearance

**Visual Comparison:**
```
❌ Before Fix:
Frame 0ms:   [white] cap it's   ← Flash!
Frame 10ms:  [GOLD]  cap it's   ← Fixed
Frame 200ms: [white] cap it's

✅ After Fix:
Frame 0ms:   [GOLD]  cap it's   ← Instant gold
Frame 200ms: [white] cap it's
```

---

### Issue 5: Overlapping at Dialogue Boundaries

**Symptom:**
- Both dialogues visible simultaneously at exact moment
- "Full cap it's" AND "fake news bruh" overlap briefly
- Happens at phrase transitions

**Root Cause:**
Dialogue 1 ends at same timestamp Dialogue 2 starts

**Example:**
```
Dialogue 1: Start=4.362s, End=5.282s
Dialogue 2: Start=5.282s, End=6.500s
           ↑
           Both render at 5.282s!
```

**Why It Fails:**
- ASS renderers display ALL dialogues active at given timestamp
- If end=start exactly, both are considered "active"
- Result: Overlapping text

**Solution:**
Add small gap (0.01s) between dialogues:

```typescript
const endTime = index < timestamps.length - 1
  ? formatASSTime(timestamps[index + 1].start - 0.01)  // Gap before next
  : formatASSTime(segment.endTime);
```

**Note:** This issue was present in earlier implementations but resolved by using proper phrase segmentation with distinct timing windows.

---

## Video Composition Issues

### Issue 6: Cache Directory Permission Denied

**Symptom:**
```
EACCES: permission denied, mkdir '/app/cache'
Error: Cannot create directory /app/cache/backgrounds
```

**Root Cause:**
Railway containers have read-only `/app` directory after build

**Why `/app` is Read-Only:**
- Docker best practice: Immutable image layers
- Railway enforces security by making app directory read-only
- Only `/tmp` and explicitly mounted volumes are writable

**Solution:**
Change cache directory to `/tmp`:

```typescript
// ❌ WRONG
const cacheDir = '/app/cache/backgrounds';

// ✅ CORRECT
const cacheDir = '/tmp/cache/backgrounds';
```

**Alternative Solutions:**
1. Use volume mount (requires Railway config)
2. Use database for cache metadata (overkill)
3. Disable caching (performance hit)

**Recommended:** Use `/tmp` - simple and effective

---

### Issue 7: Invalid Job Result Format (HTTP 500)

**Symptom:**
```
HTTP 500 Internal Server Error
Zod validation error: Expected string, received undefined
```

**Root Cause:**
`S3_PUBLIC_URL` environment variable set incorrectly

**Wrong Configuration:**
```bash
# ❌ WRONG: Hash instead of URL
S3_PUBLIC_URL=abc123def456
```

**Correct Configuration:**
```bash
# ✅ CORRECT: Full public URL
S3_PUBLIC_URL=https://assets.easybrainrot.com
```

**Why It Fails:**
```typescript
// Code expects full URL
const publicUrl = `${env.S3_PUBLIC_URL}/${key}`;
// Wrong: "abc123def456/videos/xyz.mp4" (invalid URL)
// Correct: "https://assets.easybrainrot.com/videos/xyz.mp4"
```

**How to Diagnose:**
```bash
# Check Railway environment variables
# Go to Railway → Variables tab
# Verify S3_PUBLIC_URL format
```

---

## Deployment Issues

### Issue 8: FFmpeg Not Found in Container

**Symptom:**
```
Error: ffmpeg: command not found
/bin/sh: ffmpeg: not found
```

**Root Cause:**
FFmpeg binaries not properly copied to container

**Solution:**
Verify `Dockerfile` has correct copy commands:

```dockerfile
FROM node:22-alpine AS ffmpeg
# ... ffmpeg build steps ...

FROM node:22-alpine AS runtime
# ... other setup ...

# Copy FFmpeg binaries
COPY --from=ffmpeg /bin/ffmpeg /bin/ffmpeg
COPY --from=ffmpeg /bin/ffprobe /bin/ffprobe
COPY --from=ffmpeg /lib /lib
```

**Verification:**
```bash
# Build and test locally
docker build -t ffmpeg-rest .
docker run ffmpeg-rest ffmpeg -version
# Should show: ffmpeg version 7.1
```

---

### Issue 9: Railway Build Fails

**Symptom:**
```
Build failed: npm ERR! code ELIFECYCLE
npm ERR! Exit status 1
```

**Common Causes:**
1. Missing dependencies in `package.json`
2. TypeScript errors
3. Missing environment variables at build time
4. Out of memory during build

**Solutions:**

**1. Check TypeScript:**
```bash
# Locally
npm run build
# Fix all TypeScript errors before pushing
```

**2. Check Dependencies:**
```bash
# Verify all imports have corresponding packages
npm install
```

**3. Increase Railway Memory:**
- Go to Railway → Settings → Resources
- Increase memory allocation
- Redeploy

**4. Check Build Logs:**
- Railway → Deployments → Click deployment
- Scroll through logs for exact error
- Fix and push again

---

## Performance Issues

### Issue 10: Video Processing Too Slow

**Symptom:**
- First video: 90+ seconds processing time
- Subsequent videos: Still 60+ seconds
- Users timing out

**Root Causes:**
1. Background video re-downloaded every time
2. FFmpeg preset too slow
3. Large file sizes
4. Network latency

**Solutions:**

**1. Implement Background Caching:**
```typescript
// Download once, reuse forever (container lifetime)
const backgroundPath = await getCachedBackgroundVideo(
  'minecraft',  // Background ID
  backgroundUrl
);
```

**Performance Gain:** 30-60 seconds saved per video after first download

**2. Optimize FFmpeg Preset:**
```bash
# Slow (good quality, slow processing)
-preset medium -crf 18

# Fast (good quality, faster processing)
-preset fast -crf 23

# Very fast (acceptable quality, very fast)
-preset veryfast -crf 25
```

**3. Reduce Output Resolution (if acceptable):**
```bash
# 1080x1920 (full quality, slower)
-s 1080x1920

# 720x1280 (smaller, faster)
-s 720x1280
```

**4. Use Railway US Region:**
- Closer to Cloudflare R2 (if using US region)
- Lower network latency
- Faster downloads/uploads

---

### Issue 11: Railway Container Memory Issues

**Symptom:**
```
Error: Command failed: ffmpeg ...
Killed
Container restarted
```

**Root Cause:**
FFmpeg using too much memory for large videos

**Solutions:**

**1. Increase Railway Memory:**
- Settings → Resources
- Upgrade to higher tier (4GB recommended)

**2. Process Videos in Chunks:**
```typescript
// Instead of processing 5-minute video at once
// Process in 1-minute segments and concat
```

**3. Reduce Concurrency:**
```bash
# .env
WORKER_CONCURRENCY=2  # Instead of 5
```

**4. Monitor Memory Usage:**
- Railway → Metrics
- Watch memory graph during processing
- Adjust based on patterns

---

## Storage Issues

### Issue 12: R2 Upload Fails

**Symptom:**
```
Error: Failed to upload to S3/R2
Access Denied (403)
```

**Common Causes:**
1. Invalid access keys
2. Wrong bucket name
3. Missing bucket permissions
4. Incorrect endpoint URL

**Solutions:**

**1. Verify Credentials:**
```bash
# Test with AWS CLI (R2 is S3-compatible)
aws s3 ls \
  --endpoint-url https://ACCOUNT_ID.r2.cloudflarestorage.com \
  s3://easybrainrot-assets

# Should list bucket contents
```

**2. Check Environment Variables:**
```bash
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com  # Include account ID
S3_REGION=auto  # Always "auto" for R2
S3_BUCKET=easybrainrot-assets  # Exact bucket name
S3_ACCESS_KEY_ID=...  # From R2 API token
S3_SECRET_ACCESS_KEY=...  # From R2 API token
```

**3. Verify Bucket Permissions:**
- Cloudflare → R2 → Bucket → Settings
- Ensure API token has "Edit" permissions
- Check bucket is not read-only

---

### Issue 13: Public URLs Not Working

**Symptom:**
- Video uploads successfully
- URL returned: `https://assets.easybrainrot.com/videos/xyz.mp4`
- **But opening URL shows 404 or Access Denied**

**Root Causes:**
1. Custom domain not configured
2. Public access not enabled
3. Wrong public URL format

**Solutions:**

**1. Enable Public Access:**
```bash
# Cloudflare → R2 → Bucket → Settings → Public Access
# Enable: "Allow public read access"
```

**2. Configure Custom Domain:**
```bash
# Cloudflare → R2 → Bucket → Settings → Custom Domains
# Add: assets.easybrainrot.com → easybrainrot-assets bucket
```

**3. Update Environment Variable:**
```bash
# Use custom domain URL
S3_PUBLIC_URL=https://assets.easybrainrot.com

# NOT the R2 storage endpoint
# S3_PUBLIC_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com  # WRONG
```

---

## Development Issues

### Issue 14: Local Testing Fails

**Symptom:**
```
Error: Cannot connect to Redis
ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
Start Redis locally:

```bash
# Using Docker
docker-compose up -d

# Or using Docker directly
docker run -d -p 6379:6379 redis:7-alpine

# Verify
docker ps | grep redis
```

---

### Issue 15: TypeScript Import Errors

**Symptom:**
```
Cannot find module '@/utils/ass-generator'
Module not found: Can't resolve '../utils/ass-generator'
```

**Solutions:**

**1. Check File Exists:**
```bash
ls -la src/utils/ass-generator.ts
```

**2. Use Correct Import Path:**
```typescript
// If using path alias (@)
import { generateASS } from '@/utils/ass-generator';

// If using relative imports
import { generateASS } from '../utils/ass-generator';
```

**3. Verify tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**4. Rebuild:**
```bash
npm run build
```

---

## Quick Diagnostic Checklist

### Caption Not Showing
- [ ] Fonts installed in Docker? (`fc-list | grep liberation`)
- [ ] ASS file generated? (check logs)
- [ ] FFmpeg using ASS filter? (check command)
- [ ] Correct font name in ASS? (match installed font)

### Caption Overlapping
- [ ] Using phrase segmentation? (not per-word)
- [ ] Only one dialogue per phrase?
- [ ] No timing overlaps between dialogues?
- [ ] Gap between dialogue end/start? (0.01s)

### Gold Highlighting Missing
- [ ] Using relative timing? (not absolute)
- [ ] Correct color format? (&H0000D7FF for gold)
- [ ] Animation tags properly escaped? (\\1c, \\t)
- [ ] First word starts gold? (special case)

### Deployment Failing
- [ ] Build passes locally? (`npm run build`)
- [ ] All dependencies in package.json?
- [ ] Environment variables set in Railway?
- [ ] Redis service added to project?

### Performance Slow
- [ ] Background caching enabled?
- [ ] Using `/tmp` for cache directory?
- [ ] FFmpeg preset optimized? (`-preset fast`)
- [ ] Railway resources sufficient? (4GB+ memory)

---

## Getting Help

**Documentation:**
- [CAPTION-SYSTEM.md](./CAPTION-SYSTEM.md) - Caption implementation details
- [CUSTOMIZATION-GUIDE.md](./CUSTOMIZATION-GUIDE.md) - Setup walkthrough
- [API-REFERENCE.md](./API-REFERENCE.md) - API usage

**External Resources:**
- FFmpeg Community: https://ffmpeg.org/contact.html
- Railway Discord: https://discord.gg/railway
- ASS Format Spec: http://www.tcax.org/docs/ass-specs.htm

**Logs:**
- Railway → Deployments → Click deployment → Logs
- Railway → Observability → Logs (historical)

---

**Status:** ✅ Based on Production Experience
**Last Updated:** November 23, 2025
**Issues Documented:** 15 (all resolved)
