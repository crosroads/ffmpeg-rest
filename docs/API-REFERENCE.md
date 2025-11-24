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
- 🎵 **Background Music Mixing**: Mix background music with TTS narration at customizable volume levels
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
| `watermarkScale` | number | ❌ No | `0.30` | **Watermark scale relative to video width** (0.0-1.0). Default: 0.30 (30% of video width). Recommended: 0.25-0.35 for subtle branding. |
| `watermarkOpacity` | number | ❌ No | `0.7` | **Watermark opacity/transparency** (0.0-1.0). Default: 0.7 (70%, semi-transparent). Recommended: 0.6-0.8 for professional subtle branding. |
| `resolution` | string | ❌ No | `"1080x1920"` | Output video resolution (WIDTHxHEIGHT). |
| `watermarkPosition` | string | ❌ No | `"bottom-center"` | Watermark position (see options below). |
| `fontFamily` | string | ❌ No | `"Arial Black"` | Caption font family. |
| `fontSize` | number | ❌ No | `80` | Caption font size in pixels. |
| `primaryColor` | string | ❌ No | `"#FFFFFF"` | Caption text color (hex format) - color of unspoken words. |
| `highlightColor` | string | ❌ No | `"#FFD700"` | **Caption highlight color (hex format) - words transition to this color as they're spoken** (karaoke effect). |
| `musicUrl` | string (URL) | ❌ No | - | **URL of background music** (MP3/WAV). Will be mixed with TTS audio at specified volume. Music loops if shorter than video duration. |
| `musicVolume` | number | ❌ No | `0.4` | **Background music volume** (0.0-1.0). TTS narration is always at 100%. Default: 0.4 (40%, -8dB). Recommended: 0.2-0.6 depending on content energy. |

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

### Example Request (With Background Music)

```json
POST /video/compose
Content-Type: application/json

{
  "backgroundUrl": "https://assets.easybrainrot.com/backgrounds/minecraft-parkour.mp4",
  "backgroundId": "minecraft",
  "audioUrl": "https://assets.easybrainrot.com/audio/abc123.mp3",
  "musicUrl": "https://assets.easybrainrot.com/music/energetic-electronic.mp3",
  "musicVolume": 0.4,
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
  "watermarkScale": 0.30,
  "watermarkOpacity": 0.7,
  "resolution": "1080x1920",
  "watermarkPosition": "bottom-center",
  "fontFamily": "Arial Black",
  "fontSize": 80,
  "primaryColor": "#FFFFFF",
  "highlightColor": "#FFD700"
}
```

### Example Request (Without Music)

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
    { "word": "brainrot", "start": 0.4, "end": 1.0 }
  ],
  "duration": 5.0,
  "resolution": "1080x1920"
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

## 🎵 Background Music Mixing Explained

### How It Works

The video composition endpoint can mix background music with TTS narration using FFmpeg's `amix` audio filter. This creates professional-quality videos with balanced audio levels.

**Audio Mixing Process:**

1. **TTS Narration**: Always at 100% volume (primary audio)
2. **Background Music**: Adjustable volume (default: 25%)
3. **Mixing**: Both tracks are combined using FFmpeg's `amix` filter
4. **Looping**: Music automatically loops if shorter than video duration
5. **Output**: Single audio track with both TTS and music

**Visual Representation:**
```
TTS Audio:     [========================================] 100% (0dB)
Background:    [================] 40% (loops, -8dB)
               ↓
Mixed Output:  [========================================]
               TTS (clear, prominent) + Music (balanced background)
```

### Configuration

**musicUrl** (optional)
- URL to MP3 or WAV music file
- Music will loop automatically if shorter than video
- If omitted, video has TTS-only audio

**musicVolume** (optional, default: 0.4)
- Range: 0.0 to 1.0
- Recommended: 0.2 - 0.6 (20% - 60%)
- TTS narration is always at 100%

**Volume Balance Guide** (Based on YouTube/TikTok Best Practices):

| Linear Value | Decibels | Use Case | Description | Best For |
|--------------|----------|----------|-------------|----------|
| `0.2` | -14dB | Subtle | Music barely noticeable | Tutorials, educational content |
| **`0.4`** | **-8dB** | **Balanced (Default)** | **Music clearly audible, TTS dominant** | **Brainrot, TikTok, engaging content** |
| `0.6` | -4dB | Prominent | Music nearly as loud as voice | High-energy, music-driven content |
| `0.8` | -2dB | Equal mix | Music and TTS at similar levels | Experimental (not recommended) |

**Industry Standards:**
- YouTube tutorials/podcasts: -20dB to -30dB (music very subtle)
- Engaging content videos: -10dB to -15dB (balanced mix)
- TikTok/Brainrot/Shorts: -4dB to -8dB (energetic, music-driven)
- YouTube normalization target: -14 LUFS overall loudness

### FFmpeg Implementation

**Command structure:**
```bash
ffmpeg \
  -i background.mp4 \
  -stream_loop -1 -i music.mp3 \      # Loop music infinitely
  -i tts-audio.mp3 \
  -filter_complex "
    [1:a]volume=1.0[tts];             # TTS at 100% (0dB)
    [2:a]volume=0.4[music];           # Music at 40% (-8dB, default)
    [tts][music]amix=inputs=2:duration=first[audio]  # Mix TTS + music
  " \
  -map 0:v -map [audio] \
  output.mp4
```

**Key features:**
- `-stream_loop -1` ensures music loops seamlessly
- `volume=1.0` keeps TTS at full volume (0dB, reference level)
- `volume=0.4` reduces music to 40% (-8dB below TTS, balanced for brainrot)
- `amix=inputs=2:duration=first` mixes both tracks, uses TTS duration
- Output has single mixed audio track with both sources

### Usage Examples

**With background music (default volume):**
```json
{
  "audioUrl": "https://assets.easybrainrot.com/audio/narration.mp3",
  "musicUrl": "https://assets.easybrainrot.com/music/energetic.mp3"
  // musicVolume defaults to 0.4 (-8dB, balanced for brainrot)
}
```

**With custom music volume:**
```json
{
  "audioUrl": "https://assets.easybrainrot.com/audio/narration.mp3",
  "musicUrl": "https://assets.easybrainrot.com/music/chill-vibes.mp3",
  "musicVolume": 0.2  // Subtle background for calmer content
}
```

**Without background music:**
```json
{
  "audioUrl": "https://assets.easybrainrot.com/audio/narration.mp3"
  // No musicUrl = TTS-only audio
}
```

### Best Practices

1. **Choose loopable music** - Tracks with seamless transitions work best for videos longer than music duration
2. **Match music to content energy**:
   - High-energy brainrot/TikTok: 0.4-0.6 (prominent music)
   - Educational/tutorial: 0.2-0.3 (subtle background)
   - Podcasts/interviews: 0.1-0.2 (barely noticeable)
3. **Test your specific music** - Some tracks are pre-mastered louder than others, adjust accordingly
4. **Keep TTS intelligible** - Narration should always be clearly audible above music
5. **Consider target platform**:
   - TikTok/YouTube Shorts: Higher volumes (0.4-0.6) for engagement
   - YouTube long-form: Medium volumes (0.3-0.4) for retention
   - Podcasts: Low volumes (0.1-0.2) for clarity
6. **Use royalty-free music** - Ensure proper licensing for commercial use
7. **Monitor loudness** - YouTube normalizes to -14 LUFS, consider overall mix loudness

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
  watermarkScale?: number;
  watermarkOpacity?: number;
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

## 🎨 Watermark Customization Guide

### Overview

The video composition endpoint supports dynamic watermark scaling and opacity control, allowing you to adjust watermark prominence without regenerating image files.

**Key Parameters:**
- `watermarkScale`: Size relative to video width (0.0-1.0)
- `watermarkOpacity`: Transparency level (0.0-1.0)
- `watermarkPosition`: Placement on video (9 positions available)

### Scale Configuration

**watermarkScale** controls watermark size as a percentage of video width:

| Value | Size | Description | Best For |
|-------|------|-------------|----------|
| `0.25` | 25% | Minimal | Very subtle branding, podcast clips |
| **`0.30`** | **30%** | **Balanced (Default)** | **Professional subtle branding, brainrot videos** |
| `0.35` | 35% | Noticeable | Stronger branding presence |
| `0.40` | 40% | Prominent | High visibility, educational content |
| `0.50` | 50% | Large | Maximum branding (may distract) |

**Example:**
```json
{
  "watermarkUrl": "https://example.com/logo.png",
  "watermarkScale": 0.30,  // 324px wide at 1080x1920 resolution
  "resolution": "1080x1920"
}
```

**Resolution Impact:**
```
1080x1920 (vertical):  0.30 scale = 324px watermark width
1920x1080 (horizontal): 0.30 scale = 576px watermark width
1080x1080 (square):    0.30 scale = 324px watermark width
```

### Opacity Configuration

**watermarkOpacity** controls transparency (0.0 = invisible, 1.0 = fully opaque):

| Value | Opacity | Description | Best For |
|-------|---------|-------------|----------|
| `0.5` | 50% | Very subtle | Minimal distraction |
| `0.6` | 60% | Subtle | Light branding |
| **`0.7`** | **70%** | **Semi-transparent (Default)** | **Professional standard** |
| `0.8` | 80% | Noticeable | Strong branding |
| `1.0` | 100% | Fully opaque | Maximum visibility |

**Industry Standards:**
- **Brainrot/TikTok**: 0.6-0.7 (subtle, doesn't compete with captions)
- **YouTube**: 0.7-0.8 (slightly more visible)
- **Corporate/Professional**: 0.7 (balanced visibility)
- **Minimal Branding**: 0.5-0.6 (very subtle)

### Position Options

Combine scale/opacity with position for optimal placement:

**Bottom Positions** (recommended for brainrot/vertical videos):
```json
{
  "watermarkPosition": "bottom-center",  // Centered, safe zone
  "watermarkScale": 0.30,
  "watermarkOpacity": 0.7
}
```

**Top/Corner Positions** (for horizontal/educational videos):
```json
{
  "watermarkPosition": "top-right",     // Classic corner placement
  "watermarkScale": 0.25,              // Smaller for less obstruction
  "watermarkOpacity": 0.8              // Slightly more visible
}
```

### Usage Examples

**Subtle Brainrot Watermark (Recommended):**
```json
{
  "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
  "watermarkScale": 0.30,
  "watermarkOpacity": 0.7,
  "watermarkPosition": "bottom-center"
}
```

**Minimal Watermark (Very Subtle):**
```json
{
  "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
  "watermarkScale": 0.25,
  "watermarkOpacity": 0.6,
  "watermarkPosition": "bottom-right"
}
```

**Prominent Watermark (High Visibility):**
```json
{
  "watermarkUrl": "https://assets.easybrainrot.com/watermark.png",
  "watermarkScale": 0.40,
  "watermarkOpacity": 0.9,
  "watermarkPosition": "top-right"
}
```

### Best Practices

1. **Start with defaults** (scale: 0.30, opacity: 0.7) and adjust based on visual testing
2. **Vertical videos** (9:16): Use smaller scales (0.25-0.35) to preserve caption space
3. **Horizontal videos** (16:9): Can use larger scales (0.30-0.40) with more room
4. **High-energy content**: Lower opacity (0.6-0.7) to avoid distraction
5. **Professional/corporate**: Higher opacity (0.7-0.8) for brand visibility
6. **Test on mobile**: Most viewers watch on phones - ensure readability on small screens
7. **Contrast matters**: Use opacity to balance watermark visibility against varied backgrounds

### FFmpeg Implementation

The watermark overlay is achieved using FFmpeg's `scale` and `format` filters:

```bash
ffmpeg \
  -i background.mp4 \
  -i watermark.png \
  -filter_complex "
    [1:v]scale=iw*0.30:-1,format=yuva420p,colorchannelmixer=aa=0.7[logo];
    [0:v][logo]overlay=x=(W-w)/2:y=H-h-50[watermarked]
  " \
  output.mp4
```

**Breakdown:**
- `scale=iw*0.30:-1`: Scale watermark to 30% of input width, maintain aspect ratio
- `format=yuva420p`: Enable alpha channel for transparency
- `colorchannelmixer=aa=0.7`: Set opacity to 70%
- `overlay=...`: Position watermark (bottom-center with 50px padding)

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
