# Quick Start - FFmpeg Video Composition Setup

**TL;DR:** Fork repository → Add 6 files → Push to GitHub → Deploy on Railway

---

## ⚡ 5-Minute Setup

```bash
# 1. Fork & Clone
git clone https://github.com/YOUR_USERNAME/ffmpeg-rest.git
cd ffmpeg-rest
git checkout -b feature/video-composition

# 2. Install
npm install

# 3. Add Custom Files (see guide)
# - src/utils/ass-generator.ts
# - src/utils/watermark-positions.ts
# - src/utils/download.ts
# - Modify: src/queue/processor.ts
# - Modify: src/components/video/schemas.ts
# - Modify: src/components/video/controller.ts

# 4. Test Build
npm run build

# 5. Push
git add .
git commit -m "feat: add video composition endpoint"
git push origin feature/video-composition

# 6. Merge to main
git checkout main
git merge feature/video-composition
git push origin main

# 7. Deploy on Railway
# → Go to https://railway.com
# → New Project → Deploy from GitHub
# → Select YOUR_USERNAME/ffmpeg-rest
# → Add Redis database
# → Set environment variables (see below)
```

---

## 🔑 Environment Variables (Railway)

```bash
PORT=3000
NODE_ENV=production
REDIS_URL=${{Redis.REDIS_URL}}
STORAGE_MODE=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=easybrainrot-assets
S3_ACCESS_KEY_ID=<your_r2_key>
S3_SECRET_ACCESS_KEY=<your_r2_secret>
S3_PUBLIC_URL=https://assets.easybrainrot.com
```

---

## ✅ Deployment Progress Checklist

### Implementation (Completed ✅)
- [x] Created `src/utils/ass-generator.ts` - ASS subtitle generation with karaoke highlighting
- [x] Created `src/utils/watermark-positions.ts` - 9 preset watermark positions
- [x] Created `src/utils/download.ts` - File download with background video caching
- [x] Updated `src/queue/index.ts` - Added VIDEO_COMPOSE job type
- [x] Updated `src/queue/video/schemas.ts` - Added VideoComposeJobDataSchema
- [x] Updated `src/queue/video/processor.ts` - Added processVideoCompose function
- [x] Updated `src/worker.ts` - Registered VIDEO_COMPOSE in worker
- [x] Updated `src/components/video/schemas.ts` - Added composeVideoRoute schema
- [x] Updated `src/components/video/controller.ts` - Added /video/compose endpoint
- [x] Build verified - No TypeScript errors
- [x] Git committed and pushed to main branch

### Railway Deployment (Completed ✅)
- [x] Created Railway project from GitHub repo (crosroads/ffmpeg-rest)
- [x] Added Redis database service
- [x] Connected Redis to ffmpeg-rest service
- [x] Set `REDIS_URL=${{Redis.REDIS_URL}}`
- [x] Set `STORAGE_MODE=s3`
- [x] Configured Cloudflare R2 credentials:
  - [x] `S3_ENDPOINT` - R2 endpoint URL
  - [x] `S3_REGION=auto`
  - [x] `S3_BUCKET=easybrainrot-assets`
  - [x] `S3_ACCESS_KEY_ID` - R2 API token
  - [x] `S3_SECRET_ACCESS_KEY` - R2 secret key
  - [x] `S3_PUBLIC_URL=https://assets.easybrainrot.com`
  - [x] `S3_PATH_PREFIX=ffmpeg-rest`
- [x] Deployment successful - Service running
- [x] Redis health check passed (version 8.2.1)
- [x] S3 health check passed
- [x] Public URL configured

### Deployment Verification Logs

**✅ All Systems Operational**

```log
[WORKER] ✅ Redis health check passed (version: 8.2.1)
[WORKER] 🔄 Worker started processing queue: ffmpeg-jobs
[WORKER] ⚙️  Concurrency: 5
[WORKER] 💾 Storage Mode: S3
[WORKER]    S3 Bucket: easybrainrot-assets
[WORKER]    S3 Region: auto
[WORKER]    S3 Prefix: ffmpeg-rest
[WORKER] ✅ S3 health check passed

[SERVER] ✅ Redis health check passed (version: 8.2.1)
[SERVER] 🚀 FFmpeg REST API started
[SERVER] Server running on port: 8080
[SERVER] Storage mode: s3
```

**Service Status:**
- ✅ Server: Running and accepting requests
- ✅ Worker: Running and processing jobs
- ✅ Redis: Connected (v8.2.1)
- ✅ R2 Storage: Connected and verified
- ✅ Background caching: Enabled (`/app/cache/backgrounds/`)
- ✅ Deduplication: Enabled (90-day TTL)

---

## 🧪 Test the API

### 1. Access API Documentation

Visit your Railway public URL to view interactive docs:
```
https://your-app.up.railway.app/reference
```

Available endpoints:
- `/doc` - OpenAPI 3.1 specification (JSON)
- `/reference` - Interactive API documentation (Scalar UI)
- `/llms.txt` - LLM-friendly markdown documentation
- `/health` - Health check endpoint

### 2. Test Video Composition

```bash
# Replace with your actual Railway URL
RAILWAY_URL="https://your-app.up.railway.app"

# Basic test (minimal parameters)
curl -X POST $RAILWAY_URL/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft.mp4",
    "backgroundId": "minecraft",
    "audioUrl": "https://assets.easybrainrot.com/audio/test.mp3",
    "wordTimestamps": [
      {"word": "This", "start": 0.0, "end": 0.5},
      {"word": "is", "start": 0.5, "end": 1.0},
      {"word": "a", "start": 1.0, "end": 1.2},
      {"word": "test", "start": 1.2, "end": 1.8}
    ],
    "duration": 5.0,
    "resolution": "1080x1920"
  }'

# Advanced test (with watermark and custom styling)
curl -X POST $RAILWAY_URL/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft.mp4",
    "backgroundId": "minecraft",
    "audioUrl": "https://assets.easybrainrot.com/audio/test.mp3",
    "wordTimestamps": [
      {"word": "Hello", "start": 0.0, "end": 0.5},
      {"word": "world", "start": 0.5, "end": 1.0}
    ],
    "duration": 5.0,
    "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
    "watermarkPosition": "bottom-center",
    "resolution": "1080x1920",
    "fontFamily": "Arial Black",
    "fontSize": 80,
    "primaryColor": "#FFFFFF",
    "highlightColor": "#FFD700"
  }'
```

**Expected Response:**
```json
{
  "url": "https://assets.easybrainrot.com/ffmpeg-rest/2025-11-23-uuid/output.mp4"
}
```

### 3. Verify Background Caching

First request for a `backgroundId`:
```bash
# First request downloads background (~30-60s)
time curl -X POST $RAILWAY_URL/video/compose -H "Content-Type: application/json" -d '{...}'
# Response time: ~35-65s
```

Subsequent requests with same `backgroundId`:
```bash
# Second request uses cached background (~5-10s)
time curl -X POST $RAILWAY_URL/video/compose -H "Content-Type: application/json" -d '{...}'
# Response time: ~8-15s (much faster!)
```

Check Railway logs for cache confirmation:
```log
[Cache HIT] Using cached background: minecraft
```

---

## 📁 Files to Create/Modify

### ✅ New Files (3)
1. `src/utils/ass-generator.ts` - Caption generation
2. `src/utils/watermark-positions.ts` - Watermark positioning
3. `src/utils/download.ts` - File downloading

### ✅ Modified Files (3)
4. `src/queue/processor.ts` - Add `VIDEO_COMPOSE` job type
5. `src/components/video/schemas.ts` - Add API schema
6. `src/components/video/controller.ts` - Add endpoint handler

**Total:** ~800 lines of code to add

---

## 💰 Cost

**Railway:**
- Base: $5/month
- Per video: ~$0.003
- 1,000 videos: ~$8/month

**R2 Storage:**
- Storage: Free (first 10GB)
- Egress: $0.00 (Cloudflare R2 has no egress fees!)

**Total:** ~$5-10/month for unlimited projects

---

## 🚀 Next Steps

### Completed ✅
1. ~~Implementation complete~~ - All 9 files created/modified
2. ~~Railway deployment~~ - Service running with Redis and R2
3. ~~Environment configuration~~ - All variables set correctly
4. ~~Health checks passing~~ - Redis v8.2.1, R2 connected

### Ready for Production 🎬
1. **Test the endpoint** - Use curl commands above to verify video composition
2. **Set up authentication** (optional):
   ```bash
   # Add to Railway environment variables
   AUTH_TOKEN=your-secure-random-token-here
   ```
3. **Create watermark** - Design easybrainrot.com logo (PNG with transparency)
4. **Upload background videos** - To R2 bucket at `backgrounds/` prefix:
   - minecraft.mp4 (1080x1920, loopable)
   - subway-surfers.mp4 (1080x1920, loopable)
   - gta.mp4 (1080x1920, loopable)
5. **Integrate with EasyBrainrot app**:
   - Update `src/services/video-composer.ts` to call Railway API
   - Use the public URL: `https://your-app.up.railway.app/video/compose`
   - Pass word timestamps from Whisper API
   - Save returned video URL to database

### Recommended: Monitor Your Service
- **Railway Logs**: Monitor FFmpeg processing and errors
- **R2 Dashboard**: Track storage usage and bandwidth
- **Redis Insights**: Monitor queue depth and job completion rates

---

## 🐛 Common Issues

**Build fails:** Check TypeScript imports use `~/*` paths
**FFmpeg not found:** Should be in Docker image (check Dockerfile)
**Redis error:** Add Redis service in Railway
**S3 upload fails:** Verify R2 credentials and endpoint URL
**Captions not showing:** Check ASS file syntax and font availability

---

**Full Documentation:** See `FFMPEG-CUSTOMIZATION-GUIDE.md` for detailed step-by-step instructions.
