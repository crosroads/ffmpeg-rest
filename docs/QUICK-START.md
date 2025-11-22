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

## 🧪 Test It

```bash
# Get your Railway URL
RAILWAY_URL="https://your-app.railway.app"

# Test video composition
curl -X POST $RAILWAY_URL/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft.mp4",
    "audioUrl": "https://assets.easybrainrot.com/audio/test.mp3",
    "wordTimestamps": [
      {"word": "This", "start": 0.0, "end": 0.2},
      {"word": "is", "start": 0.2, "end": 0.4},
      {"word": "brainrot", "start": 0.4, "end": 1.0}
    ],
    "duration": 5,
    "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
    "resolution": "1080x1920"
  }'
```

**Expected:** `{"url": "https://assets.easybrainrot.com/videos/xxx.mp4"}`

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

1. **Follow full guide:** `FFMPEG-CUSTOMIZATION-GUIDE.md`
2. **Create watermark:** Design easybrainrot.com logo (PNG, transparent)
3. **Commission background videos:** Order on Fiverr (1080x1920, 5min, seamless loop)
4. **Integrate with EasyBrainrot:** Update `src/services/video-composer.ts`

---

## 🐛 Common Issues

**Build fails:** Check TypeScript imports use `~/*` paths
**FFmpeg not found:** Should be in Docker image (check Dockerfile)
**Redis error:** Add Redis service in Railway
**S3 upload fails:** Verify R2 credentials and endpoint URL
**Captions not showing:** Check ASS file syntax and font availability

---

**Full Documentation:** See `FFMPEG-CUSTOMIZATION-GUIDE.md` for detailed step-by-step instructions.
