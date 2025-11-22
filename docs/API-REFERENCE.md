# Video Composition API Reference

**Service:** Railway FFmpeg Video Composer
**Base URL:** `https://your-app.railway.app`
**Authentication:** Bearer token (optional)

---

## 📡 Endpoint: Compose Video

**URL:** `POST /video/compose`

**Description:** Merges background video with audio, adds **karaoke-style word-level captions with real-time highlighting**, and overlays watermark. Returns S3/R2 URL of final video.

**Key Features:**
- ✨ **Karaoke Highlighting**: Words transition to gold color as they're spoken, synchronized with audio
- ⚡ **Background Caching**: First request downloads background (~30-60s), all subsequent requests use cache (instant)
- 📱 **Mobile-Optimized**: Vertical 1080x1920 format for TikTok/Instagram Reels
- 🎬 **Professional Quality**: H.264 encoding, 30 FPS, optimized bitrate

**Requirements:**
- S3/R2 storage mode must be enabled
- All asset URLs must be publicly accessible
- Background video should be longer than audio duration
- Word timestamps required for caption highlighting

---

### Request

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>  (if BEARER_TOKENS configured)
```

**Body Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `backgroundUrl` | string (URL) | ✅ Yes | - | URL of background video (MP4). Should be longer than audio duration. |
| `backgroundId` | string | ⚡ Recommended | `"default"` | **Background identifier for caching** (e.g., "minecraft", "subway"). First request downloads and caches, subsequent requests are instant. |
| `audioUrl` | string (URL) | ✅ Yes | - | URL of audio file (MP3/WAV). |
| `wordTimestamps` | array | ✅ Yes | - | **Array of word-level timestamps for karaoke captions** (required for highlighting effect). |
| `duration` | number | ✅ Yes | - | Video duration in seconds (should match audio duration). |
| `watermarkUrl` | string (URL) | ❌ No | - | URL of watermark image (PNG with transparency). |
| `resolution` | string | ❌ No | `"1080x1920"` | Output video resolution (WIDTHxHEIGHT). |
| `watermarkPosition` | string | ❌ No | `"bottom-center"` | Watermark position (see options below). |
| `fontFamily` | string | ❌ No | `"Arial Black"` | Caption font family. |
| `fontSize` | number | ❌ No | `80` | Caption font size in pixels. |
| `primaryColor` | string | ❌ No | `"#FFFFFF"` | Caption text color (hex format) - color of unspoken words. |
| `highlightColor` | string | ❌ No | `"#FFD700"` | **Caption highlight color (hex format) - words transition to this color as they're spoken** (karaoke effect). |

**Word Timestamp Object:**
```typescript
{
  word: string;    // The word text
  start: number;   // Start time in seconds (e.g., 0.25)
  end: number;     // End time in seconds (e.g., 0.50)
}
```

**Watermark Position Options:**
- `top-left`, `top-center`, `top-right`
- `middle-left`, `middle-center`, `middle-right`
- `bottom-left`, `bottom-center`, `bottom-right`

---

### Example Request

```json
POST /video/compose
Content-Type: application/json

{
  "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft-parkour.mp4",
  "backgroundId": "minecraft",
  "audioUrl": "https://assets.easybrainrot.com/audio/abc123.mp3",
  "wordTimestamps": [
    { "word": "This", "start": 0.0, "end": 0.2 },
    { "word": "is", "start": 0.2, "end": 0.4 },
    { "word": "the", "start": 0.4, "end": 0.5 },
    { "word": "most", "start": 0.5, "end": 0.8 },
    { "word": "brainrot", "start": 0.8, "end": 1.3 },
    { "word": "video", "start": 1.3, "end": 1.7 },
    { "word": "ever", "start": 1.7, "end": 2.0 }
  ],
  "duration": 80.15,
  "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
  "resolution": "1080x1920",
  "watermarkPosition": "bottom-center",
  "fontFamily": "Arial Black",
  "fontSize": 80,
  "primaryColor": "#FFFFFF",
  "highlightColor": "#FFD700"
}
```

**Note:** The `backgroundId` enables caching - the first request for "minecraft" downloads the video (~30-60s), all subsequent requests use the cached file (instant).

---

### Response

#### Success (200 OK)

```json
{
  "url": "https://assets.easybrainrot.com/videos/xyz789abc.mp4"
}
```

**Fields:**
- `url` (string): Public URL of the composed video in S3/R2 storage

#### Error: S3 Mode Not Enabled (400 Bad Request)

```json
{
  "error": "S3 mode required",
  "message": "Video composition requires STORAGE_MODE=s3 in environment variables"
}
```

#### Error: Processing Failed (400 Bad Request)

```json
{
  "error": "Video composition failed"
}
```

**Common causes:**
- Invalid URLs (files not accessible)
- Background video shorter than audio
- Invalid timestamp format
- FFmpeg processing error

#### Error: Server Error (500 Internal Server Error)

```json
{
  "error": "Processing failed",
  "message": "Detailed error message"
}
```

---

## ✨ Karaoke Caption Highlighting Explained

### How It Works

The video composition endpoint uses **ASS (Advanced SubStation Alpha) subtitle format** with the `\k` (karaoke) tag to create word-by-word highlighting synchronized with the audio.

**Visual Timeline:**
```
Time:     0.0s -------- 0.2s -------- 0.4s -------- 0.8s -------- 1.3s
Words:    This          is            the           brainrot     video
Display:  [GOLD]        [GOLD][WHT]   [GOLD][WHT]   [GOLD]...    [GOLD]...
          ↑             ↑             ↑             ↑
          Speaking      Spoken,       Previous      Currently
          now           fades         words stay    speaking
```

**What Happens:**

1. **Before speaking**: All words appear in `primaryColor` (default: white #FFFFFF)
2. **While speaking**: Current word transitions to `highlightColor` (default: gold #FFD700)
3. **After speaking**: Word remains highlighted or fades back to primary color
4. **Timing**: Transition duration matches word duration from timestamps

**Example Visual:**
```
At t=0.8s (speaking "brainrot"):

┌─────────────────────────────┐
│                             │
│   This is the brainrot      │  ← "This is the" = gold (spoken)
│   ════ ══ ═══ ════════      │  ← "brainrot" = gold + glowing
│                             │  ← "video ever" = white (upcoming)
│                             │
│   [Minecraft parkour]       │
└─────────────────────────────┘
```

### ASS Format Details

**Generated subtitle line:**
```
Dialogue: 0,0:00:00.80,0:00:01.30,Default,,0,0,0,karaoke,{\k50}brainrot
```

**Breakdown:**
- `0:00:00.80,0:00:01.30` - Word start/end times (from `wordTimestamps`)
- `karaoke` - Effect type (enables highlighting)
- `{\k50}` - Karaoke tag with duration in centiseconds (50cs = 0.5s)
- `brainrot` - The word to display

**Style Definition:**
```
Style: Default,Arial Black,80,&H00FFFFFF,&H00FFD700,&H00000000,...
                              ↑          ↑          ↑
                              Primary    Highlight  Outline
                              (white)    (gold)     (black)
```

### Customization

You can customize the highlighting effect:

```json
{
  "primaryColor": "#FFFFFF",    // Unspoken words (white)
  "highlightColor": "#FFD700",  // Currently speaking (gold)
  "outlineColor": "#000000",    // Text outline (black)
  "fontSize": 80,               // Large for mobile viewing
  "fontFamily": "Arial Black"   // Bold, readable font
}
```

**Popular color schemes:**

| Scheme | Primary | Highlight | Use Case |
|--------|---------|-----------|----------|
| **Gold Highlight** | `#FFFFFF` | `#FFD700` | Default, classic karaoke |
| **Blue Accent** | `#FFFFFF` | `#4A90E2` | Educational, professional |
| **Red Pop** | `#FFFFFF` | `#FF6B6B` | Energetic, podcast clips |
| **Neon Green** | `#FFFFFF` | `#00FF00` | Gaming, tech content |

---

## 💻 Usage Examples

### Node.js / TypeScript

```typescript
interface VideoCompositionRequest {
  backgroundUrl: string;
  audioUrl: string;
  wordTimestamps: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  duration: number;
  watermarkUrl?: string;
  resolution?: string;
  watermarkPosition?: string;
  fontFamily?: string;
  fontSize?: number;
  primaryColor?: string;
  highlightColor?: string;
}

interface VideoCompositionResponse {
  url: string;
}

async function composeVideo(
  request: VideoCompositionRequest
): Promise<VideoCompositionResponse> {
  const response = await fetch('https://your-app.railway.app/video/compose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer your-token-here',  // If using auth
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Video composition failed: ${error.error}`);
  }

  return await response.json();
}

// Usage
const result = await composeVideo({
  backgroundUrl: 'https://assets.easybrainrot.com/backgrounds/minecraft.mp4',
  audioUrl: 'https://assets.easybrainrot.com/audio/test.mp3',
  wordTimestamps: [
    { word: 'This', start: 0.0, end: 0.2 },
    { word: 'is', start: 0.2, end: 0.4 },
    { word: 'brainrot', start: 0.4, end: 1.0 },
  ],
  duration: 5.0,
  watermarkUrl: 'https://assets.easybrainrot.com/watermark.png',
});

console.log('Video URL:', result.url);
```

### cURL

```bash
curl -X POST https://your-app.railway.app/video/compose \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token-here" \
  -d '{
    "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft.mp4",
    "audioUrl": "https://assets.easybrainrot.com/audio/test.mp3",
    "wordTimestamps": [
      {"word": "This", "start": 0.0, "end": 0.2},
      {"word": "is", "start": 0.2, "end": 0.4},
      {"word": "brainrot", "start": 0.4, "end": 1.0}
    ],
    "duration": 5.0,
    "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
    "resolution": "1080x1920",
    "watermarkPosition": "bottom-center"
  }'
```

### Python

```python
import requests

def compose_video(
    background_url: str,
    audio_url: str,
    word_timestamps: list,
    duration: float,
    watermark_url: str = None,
    **kwargs
) -> dict:
    """
    Compose video with captions and watermark

    Args:
        background_url: URL of background video
        audio_url: URL of audio file
        word_timestamps: List of {"word": str, "start": float, "end": float}
        duration: Video duration in seconds
        watermark_url: Optional watermark image URL
        **kwargs: Additional options (resolution, watermarkPosition, etc.)

    Returns:
        {"url": "https://..."}
    """
    url = "https://your-app.railway.app/video/compose"

    payload = {
        "backgroundUrl": background_url,
        "audioUrl": audio_url,
        "wordTimestamps": word_timestamps,
        "duration": duration,
        **kwargs
    }

    if watermark_url:
        payload["watermarkUrl"] = watermark_url

    headers = {
        "Content-Type": "application/json",
        # "Authorization": "Bearer your-token-here",  # If using auth
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()

    return response.json()

# Usage
result = compose_video(
    background_url="https://assets.easybrainrot.com/backgrounds/minecraft.mp4",
    audio_url="https://assets.easybrainrot.com/audio/test.mp3",
    word_timestamps=[
        {"word": "This", "start": 0.0, "end": 0.2},
        {"word": "is", "start": 0.2, "end": 0.4},
        {"word": "brainrot", "start": 0.4, "end": 1.0},
    ],
    duration=5.0,
    watermark_url="https://assets.easybrainrot.com/watermark.png",
    resolution="1080x1920",
    watermarkPosition="bottom-center"
)

print(f"Video URL: {result['url']}")
```

---

## ⚙️ Configuration Presets

### Brainrot Video (Vertical TikTok/Reels)

```json
{
  "resolution": "1080x1920",
  "watermarkPosition": "bottom-center",
  "fontFamily": "Arial Black",
  "fontSize": 80,
  "primaryColor": "#FFFFFF",
  "highlightColor": "#FFD700"
}
```

### Educational Video (Horizontal YouTube)

```json
{
  "resolution": "1920x1080",
  "watermarkPosition": "bottom-right",
  "fontFamily": "Arial",
  "fontSize": 60,
  "primaryColor": "#FFFFFF",
  "highlightColor": "#4A90E2"
}
```

### Podcast Clip (Square Instagram)

```json
{
  "resolution": "1080x1080",
  "watermarkPosition": "top-left",
  "fontFamily": "Helvetica",
  "fontSize": 50,
  "primaryColor": "#FFFFFF",
  "highlightColor": "#FF6B6B"
}
```

---

## 📊 Processing Details

**Typical Processing Time:**
- 30 seconds of video: ~15-30 seconds
- 60 seconds of video: ~30-60 seconds
- 120 seconds of video: ~60-120 seconds

**Processing includes:**
1. Download background video, audio, and watermark
2. Generate ASS subtitle file from word timestamps
3. FFmpeg processing:
   - Trim background to audio duration
   - Overlay watermark
   - Burn captions with karaoke effect
   - Mix audio
   - Encode to MP4
4. Upload to S3/R2 storage
5. Return public URL

**Output Specifications:**
- Format: MP4
- Video codec: H.264 (libx264)
- Audio codec: AAC
- Framerate: 30 FPS
- Quality: CRF 23 (balanced quality/size)
- Bitrate: Adaptive based on content

---

## 🚨 Error Handling

**Best Practices:**

1. **Validate URLs before sending:**
   ```typescript
   async function validateUrl(url: string): Promise<boolean> {
     try {
       const response = await fetch(url, { method: 'HEAD' });
       return response.ok;
     } catch {
       return false;
     }
   }
   ```

2. **Handle timeouts:**
   ```typescript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 120000); // 2 min

   try {
     const response = await fetch(url, {
       signal: controller.signal,
       // ...
     });
   } finally {
     clearTimeout(timeout);
   }
   ```

3. **Retry on failure:**
   ```typescript
   async function composeVideoWithRetry(request, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await composeVideo(request);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * (i + 1)));
       }
     }
   }
   ```

---

## 💰 Cost Estimation

**Railway charges:**
- Per video: ~$0.003 (CPU time + memory)
- Monthly base: $5 (covers ~1,666 videos)

**Formula:**
```
videos_per_month = 1666 + ((monthly_spend - $5) / $0.003)

Example:
$10/month = 1,666 + ($5 / $0.003) = 3,333 videos
$20/month = 1,666 + ($15 / $0.003) = 6,666 videos
```

**R2 Storage:**
- Storage: Free (first 10GB)
- Egress: $0.00 (Cloudflare R2 has no egress fees!)

---

## 🔒 Authentication

If `BEARER_TOKENS` environment variable is set:

```bash
# In Railway environment variables
BEARER_TOKENS=easybrainrot_prod_abc123,other_project_xyz789
```

Include token in requests:

```typescript
headers: {
  'Authorization': 'Bearer easybrainrot_prod_abc123',
  'Content-Type': 'application/json',
}
```

---

## 📝 Rate Limits

**Default limits (can be adjusted in Railway):**
- Concurrent jobs: 5 workers
- Queue size: Unlimited (Redis-backed)
- Request timeout: 5 minutes

**For high-volume usage:**
1. Increase `WORKER_CONCURRENCY` in environment variables
2. Upgrade Railway plan for more CPU/memory
3. Consider adding multiple worker instances

---

## 🎯 Integration Example (EasyBrainrot)

**File:** `src/services/video-composer.ts`

```typescript
import { getStorageService } from '@/shared/services/storage';

const RAILWAY_API_URL = process.env.RAILWAY_FFMPEG_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

export async function composeVideo(options: {
  audioUrl: string;
  backgroundId: string;
  wordTimestamps: WordTimestamp[];
  duration: number;
}) {
  const backgroundUrl = `${process.env.R2_PUBLIC_URL}/backgrounds/${options.backgroundId}.mp4`;
  const watermarkUrl = `${process.env.R2_PUBLIC_URL}/watermark.png`;

  const response = await fetch(`${RAILWAY_API_URL}/video/compose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_API_KEY}`,
    },
    body: JSON.stringify({
      backgroundUrl,
      audioUrl: options.audioUrl,
      wordTimestamps: options.wordTimestamps,
      duration: options.duration,
      watermarkUrl,
      resolution: '1080x1920',
      watermarkPosition: 'bottom-center',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Video composition failed: ${error.error}`);
  }

  const { url } = await response.json();

  return {
    videoUrl: url,
    duration: options.duration,
    format: 'mp4',
    resolution: '1080x1920',
  };
}
```

---

## 📚 Additional Resources

- **OpenAPI Docs:** `https://your-app.railway.app/doc`
- **Interactive API:** `https://your-app.railway.app/reference`
- **Health Check:** `https://your-app.railway.app/health`

**Status:** ✅ Production Ready
**Last Updated:** November 22, 2025
