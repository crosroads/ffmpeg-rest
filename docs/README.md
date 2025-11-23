# FFmpeg REST API - EasyBrainrot Customization

This fork adds **video composition** capabilities to the original [crisog/ffmpeg-rest](https://github.com/crisog/ffmpeg-rest) template.

---

## 🎯 What's Added

**New Endpoint:** `POST /video/compose`

Composes videos with:
- ✅ Background video + audio merge
- ✨ **Word-by-word karaoke-style captions** (words highlight as spoken - REQUIRED FEATURE)
- ⚡ **Background video caching** (30-60s saved per video after first download)
- ✅ Watermark overlay (9 positions)
- ✅ Configurable styling (fonts, colors, sizes)
- ✅ Multiple output resolutions
- ✅ S3/R2 storage integration

**Use Cases:**
- Brainrot videos (TikTok/Reels)
- Educational videos (YouTube)
- Podcast clips (Instagram)
- Marketing videos
- Tutorial videos

---

## 🚀 Current Deployment Status

**Environment:** ✅ **LIVE ON RAILWAY**
- **Server:** Running (Node 22.20.0, Port 8080)
- **Worker:** Running (5 concurrent jobs)
- **Redis:** Connected (v8.2.1)
- **R2 Storage:** Connected (easybrainrot-assets)
- **Video Composition:** Fully Operational

**Last Deployment:** November 23, 2025
**Health Checks:** All Passing ✅

See **[DEPLOYMENT-STATUS.md](./DEPLOYMENT-STATUS.md)** for complete deployment details, logs, and monitoring information.

---

## 📚 Documentation

### 1. [CUSTOMIZATION-GUIDE.md](./CUSTOMIZATION-GUIDE.md) ⭐
**Complete step-by-step implementation guide**
- Fork & clone instructions
- All code to add (6 files, ~800 lines)
- Local testing procedures
- Railway deployment
- Environment configuration
- Troubleshooting

**Start here if this is your first time!**

### 2. [QUICK-START.md](./QUICK-START.md)
**TL;DR quick reference**
- 5-minute command sequence
- File checklist
- Environment variables
- Test commands
- **✅ Deployment progress tracking**

**Use this after initial setup for quick reference.**

### 3. [API-REFERENCE.md](./API-REFERENCE.md)
**API documentation and integration guide**
- Endpoint specification
- Request/response formats
- Code examples (TypeScript, Python, cURL)
- Configuration presets
- Error handling

**Use this when integrating with your application.**

### 4. [DEPLOYMENT-STATUS.md](./DEPLOYMENT-STATUS.md) 🆕
**Current production deployment status**
- Infrastructure overview
- Environment variables
- Deployment logs
- Health monitoring
- Known issues & warnings
- Testing status

**Use this to check current deployment state.**

---

## 🚀 Quick Setup

```bash
# 1. Clone this repository
git clone https://github.com/YOUR_USERNAME/ffmpeg-rest.git
cd ffmpeg-rest

# 2. Install dependencies
npm install

# 3. Follow CUSTOMIZATION-GUIDE.md to add code

# 4. Deploy on Railway
# See CUSTOMIZATION-GUIDE.md for full instructions
```

---

## 📁 Files Modified

### New Files (3)
- `src/utils/ass-generator.ts` - Caption generation
- `src/utils/watermark-positions.ts` - Watermark positioning
- `src/utils/download.ts` - File downloading

### Modified Files (3)
- `src/queue/processor.ts` - Add VIDEO_COMPOSE job type
- `src/components/video/schemas.ts` - Add API schema
- `src/components/video/controller.ts` - Add endpoint handler

**Total:** ~800 lines of code added

---

## 🎬 Example Usage

```bash
curl -X POST https://your-app.railway.app/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://assets.example.com/backgrounds/minecraft.mp4",
    "backgroundId": "minecraft",
    "audioUrl": "https://assets.example.com/audio/narration.mp3",
    "wordTimestamps": [
      {"word": "This", "start": 0.0, "end": 0.2},
      {"word": "is", "start": 0.2, "end": 0.4},
      {"word": "brainrot", "start": 0.4, "end": 1.0}
    ],
    "duration": 80.15,
    "watermarkUrl": "https://assets.example.com/watermark.png",
    "resolution": "1080x1920",
    "watermarkPosition": "bottom-center"
  }'
```

**Response:**
```json
{
  "url": "https://assets.example.com/videos/abc123.mp4"
}
```

---

## 💰 Cost

**Railway:**
- Base: $5/month
- Per video: ~$0.003
- Example: $10/month = ~3,333 videos

**Cloudflare R2:**
- Storage: Free (first 10GB)
- Egress: $0.00 (no egress fees!)

**Total:** ~$5-10/month for unlimited projects

---

## 🔧 Environment Variables

Required on Railway:

```bash
STORAGE_MODE=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=<your-key>
S3_SECRET_ACCESS_KEY=<your-secret>
S3_PUBLIC_URL=https://assets.example.com
REDIS_URL=${{Redis.REDIS_URL}}
```

See [CUSTOMIZATION-GUIDE.md](./CUSTOMIZATION-GUIDE.md) for complete configuration.

---

## 🎯 Integration Example

**From your application:**

```typescript
const response = await fetch('https://your-app.railway.app/video/compose', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    backgroundUrl: 'https://assets.example.com/backgrounds/minecraft.mp4',
    backgroundId: 'minecraft', // Enables caching for performance
    audioUrl: 'https://assets.example.com/audio/narration.mp3',
    wordTimestamps: [
      { word: 'This', start: 0.0, end: 0.2 },
      { word: 'is', start: 0.2, end: 0.4 },
      { word: 'brainrot', start: 0.4, end: 1.0 }
    ],
    duration: 80.15,
    watermarkUrl: 'https://assets.example.com/watermark.png',
  }),
});

const { url } = await response.json();
console.log('Video URL:', url);
```

See [API-REFERENCE.md](./API-REFERENCE.md) for complete integration examples.

---

## 📊 Features

| Feature | Original Template | This Fork |
|---------|------------------|-----------|
| Video to MP4 | ✅ | ✅ |
| Extract Audio | ✅ | ✅ |
| Extract Frames | ✅ | ✅ |
| **Video Composition** | ❌ | ✅ |
| **Karaoke Captions** | ❌ | ✅ |
| **Watermark Overlay** | ❌ | ✅ |
| **Configurable Styling** | ❌ | ✅ |
| S3/R2 Storage | ✅ | ✅ |
| Job Queue | ✅ | ✅ |
| API Authentication | ✅ | ✅ |

---

## 🤝 Contributing

This is a custom fork for EasyBrainrot. For the original template:
- Original: https://github.com/crisog/ffmpeg-rest
- Issues: https://github.com/crisog/ffmpeg-rest/issues

---

## 📝 License

Same as original template: Apache-2.0

---

## 🆘 Support

**For customization questions:**
- See [CUSTOMIZATION-GUIDE.md](./CUSTOMIZATION-GUIDE.md) - Troubleshooting section
- Check Railway logs for FFmpeg errors
- Review [API-REFERENCE.md](./API-REFERENCE.md) for integration help

**For original template issues:**
- Visit https://github.com/crisog/ffmpeg-rest

---

**Status:** ✅ **DEPLOYED AND OPERATIONAL**
**Environment:** Railway (Production)
**Maintained By:** EasyBrainrot Team
**Last Updated:** November 23, 2025
