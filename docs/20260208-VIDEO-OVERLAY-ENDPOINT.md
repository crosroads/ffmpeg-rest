# Video Overlay Endpoint — Implementation Spec

> `POST /video/overlay` — Apply a PNG image overlay to any video.

## Overview

A generic video overlay service that composites a PNG image onto a video using FFmpeg's `overlay` filter. The overlay PNG can come from bundled assets (Docker image) or a remote URL.

**Use cases:**
- Brand watermarks (VicSee.com, EasyBrainRot.com)
- Logo overlays for any project
- QR codes, event badges, custom graphics
- Any transparent PNG on any video

**Key properties:**
- Audio preserved via copy codec (no re-encoding)
- PNG scaled relative to video width (aspect ratio preserved)
- 4 corner positions with pixel-level margin control
- Uploads result to S3/R2, returns public URL

---

## Endpoint

### `POST /video/overlay`

**Tags:** `Video`

### Request Body

```json
{
  "videoUrl": "https://cdn.example.com/input.mp4",
  "overlayAsset": "vicsee",
  "overlayPosition": "top-right",
  "overlayScale": 0.22,
  "overlayMarginX": 20,
  "overlayMarginY": 20,
  "pathPrefix": "vicsee/fern",
  "publicUrl": "https://assets.vicsee.com"
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoUrl` | string (URL) | **Yes** | — | Source video URL to process |
| `overlayAsset` | string | No* | — | Bundled asset name in `/assets/overlays/` (e.g., `"vicsee"` loads `vicsee.png`) |
| `overlayUrl` | string (URL) | No* | — | Remote PNG URL to download and use as overlay |
| `overlayPosition` | enum | No | `"top-right"` | Corner position: `top-right`, `top-left`, `bottom-right`, `bottom-left` |
| `overlayScale` | number (0-1) | No | `0.22` | Overlay width as fraction of video width |
| `overlayMarginX` | number | No | `20` | Horizontal margin from edge in pixels |
| `overlayMarginY` | number | No | `20` | Vertical margin from edge in pixels |
| `pathPrefix` | string | No | env `S3_PATH_PREFIX` | S3 key prefix for upload organization |
| `publicUrl` | string (URL) | No | env `S3_PUBLIC_URL` | CDN domain for the returned URL |

*\*Either `overlayAsset` or `overlayUrl` must be provided. `overlayAsset` takes priority if both given.*

### Response

**200 OK:**
```json
{
  "url": "https://assets.vicsee.com/vicsee/fern/2026-02-08-a1b2c3d4/job123.mp4"
}
```

**400 Bad Request:**
```json
{
  "error": "Either overlayAsset or overlayUrl must be provided"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Video overlay processing failed: <details>"
}
```

---

## FFmpeg Filter

### Core Command

```bash
ffmpeg -i input.mp4 -i overlay.png \
  -filter_complex "[1:v]scale=iw*{scale}:-1[ovl];[0:v][ovl]overlay={position}" \
  -c:a copy \
  -y output.mp4
```

### Filter Breakdown

1. **`[1:v]scale=iw*{scale}:-1[ovl]`**
   - Takes the overlay PNG (input 1)
   - Scales width to `{scale}` fraction of its original width
   - `-1` preserves aspect ratio for height
   - Labels result as `[ovl]`

2. **`[0:v][ovl]overlay={position}`**
   - Composites `[ovl]` on top of the video (input 0)
   - Position calculated from `overlayPosition`, `overlayMarginX`, `overlayMarginY`

3. **`-c:a copy`**
   - Copies audio stream without re-encoding
   - Preserves native audio from AI video models (Veo 3.1, Kling, etc.)

### Position Expressions

| `overlayPosition` | FFmpeg overlay expression |
|--------------------|--------------------------|
| `top-right` | `W-w-{marginX}:{marginY}` |
| `top-left` | `{marginX}:{marginY}` |
| `bottom-right` | `W-w-{marginX}:H-h-{marginY}` |
| `bottom-left` | `{marginX}:H-h-{marginY}` |

Where: `W` = video width, `H` = video height, `w` = overlay width, `h` = overlay height

### Video Encoding

```
-c:v libx264 -preset fast -crf 23 -r 30
```

- **libx264** — H.264 codec (universal compatibility)
- **preset fast** — Balance of speed and compression
- **crf 23** — Visually lossless quality
- **30 fps** — Standard frame rate

---

## Architecture

### Request Flow

```
Client POST /video/overlay
    │
    ▼
Controller (src/components/video/controller.ts)
    │  Validates request with Zod schema
    │  Queues VIDEO_OVERLAY job
    │  Waits for job.waitUntilFinished()
    │
    ▼
BullMQ Queue (Redis)
    │
    ▼
Worker (src/queue/video/processor.ts → processVideoOverlay)
    │  1. Create temp directory
    │  2. Download video from videoUrl
    │  3. Resolve overlay PNG (bundled asset or remote URL)
    │  4. Build FFmpeg filter_complex
    │  5. Execute FFmpeg
    │  6. Upload to S3/R2
    │  7. Cleanup temp files
    │  8. Return { success: true, outputUrl: "..." }
    │
    ▼
Controller receives result → responds to client
```

### Job Type

```typescript
// src/queue/index.ts
export const JobType = {
  // ... existing types ...
  VIDEO_OVERLAY: 'video:overlay'
} as const;
```

### Queue Configuration

Inherits from the shared queue defaults:

| Setting | Value |
|---------|-------|
| Attempts | 3 (exponential backoff, 1s initial) |
| Timeout | 600,000ms (10 minutes) |
| Completed retention | 1 hour or 100 jobs |
| Failed retention | 24 hours or 500 jobs |

### Storage

Uses the existing `uploadToS3()` utility from `src/utils/storage.ts`:

```typescript
const { url } = await uploadToS3(
  outputPath,           // Local file path
  'video/mp4',          // Content type
  `${job.id}.mp4`,      // Original filename
  pathPrefix,           // e.g., "vicsee/fern"
  publicUrl             // e.g., "https://assets.vicsee.com"
);
```

S3 key format: `{pathPrefix}/{YYYY-MM-DD}-{uuid}/{jobId}.mp4`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `assets/overlays/vicsee.png` | Create | Copy VicSee watermark PNG (7.5 KB) |
| `assets/overlays/README.md` | Create | Document asset sources and regeneration |
| `src/components/video/schemas.ts` | Modify | Add `videoOverlayRoute` OpenAPI route definition |
| `src/components/video/controller.ts` | Modify | Add `/video/overlay` route handler |
| `src/queue/index.ts` | Modify | Add `VIDEO_OVERLAY: 'video:overlay'` constant |
| `src/queue/video/schemas.ts` | Modify | Add `VideoOverlayJobDataSchema` |
| `src/queue/video/processor.ts` | Modify | Add `processVideoOverlay()` function |
| `src/worker.ts` | Modify | Register `VIDEO_OVERLAY` → `processVideoOverlay` handler |
| `src/utils/overlay-positions.ts` | Create | 4-position helper for corner overlays |
| `Dockerfile` | Modify | Add `COPY --chown=nodejs:nodejs assets/ ./assets/` |

---

## Bundled Asset Management

### Directory Structure

```
assets/
└── overlays/
    ├── vicsee.png              # VicSee.com branding
    ├── README.md               # Asset documentation
    └── (future PNGs)
```

### Adding a New Overlay Asset

1. Place the PNG file in `assets/overlays/{name}.png`
2. The file must have a transparent background
3. Rebuild and deploy the Docker image
4. Callers reference it as `overlayAsset: "{name}"`

### Remote Overlays (No Rebuild Required)

For overlays that change frequently or are project-specific, use `overlayUrl` instead:

```json
{
  "videoUrl": "https://...",
  "overlayUrl": "https://cdn.example.com/my-logo.png",
  "overlayPosition": "bottom-right",
  "overlayScale": 0.15
}
```

The PNG is downloaded at runtime — no Docker rebuild needed. Cached in the temp directory for the duration of the job.

---

## Comparison with `/video/compose`

| Aspect | `/video/compose` | `/video/overlay` |
|--------|-------------------|-------------------|
| **Purpose** | Full video composition (brainrot) | PNG overlay on existing video |
| **Inputs** | Background + audio + subtitles + music | Video URL + PNG |
| **Watermark type** | `drawtext` (text rendering) | `overlay` (PNG image) |
| **Audio** | Mix TTS + background music | Copy codec (passthrough) |
| **Captions** | ASS subtitle generation | None |
| **Complexity** | High (15+ params) | Low (8 params) |
| **Processing time** | 30-120s | 3-8s |
| **Use case** | Brainrot video creation | Brand overlay on any video |

---

## Performance Expectations

| Video Duration | Resolution | Expected Time |
|---------------|------------|---------------|
| 5s | 720p | 2-4s |
| 5s | 1080p | 3-5s |
| 10s | 720p | 4-6s |
| 10s | 1080p | 5-8s |

The PNG overlay operation is lightweight compared to full composition:
- No audio mixing (copy codec)
- No subtitle rendering
- No background video processing
- Single `overlay` filter vs complex `filter_complex` chain

---

## Error Handling

| Error | HTTP Status | Cause |
|-------|-------------|-------|
| Missing overlay source | 400 | Neither `overlayAsset` nor `overlayUrl` provided |
| Asset not found | 400 | `overlayAsset` references a non-existent file in `/assets/overlays/` |
| Invalid overlay URL | 400 | `overlayUrl` is not a valid URL |
| Video download failed | 500 | `videoUrl` unreachable or timeout |
| Overlay download failed | 500 | `overlayUrl` unreachable or timeout |
| FFmpeg failed | 500 | Processing error (corrupt video, unsupported codec) |
| S3 upload failed | 500 | Storage upload error |
| S3 mode not enabled | 400 | `STORAGE_MODE` is not `s3` (required for URL response) |

---

## Testing

### Manual curl test (after deployment)

```bash
# Using bundled asset
curl -X POST https://ffmpeg.example.com/video/overlay \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://cdn.example.com/test-video.mp4",
    "overlayAsset": "vicsee",
    "overlayPosition": "top-right",
    "overlayScale": 0.22,
    "pathPrefix": "test/overlay",
    "publicUrl": "https://assets.vicsee.com"
  }'

# Using remote URL
curl -X POST https://ffmpeg.example.com/video/overlay \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://cdn.example.com/test-video.mp4",
    "overlayUrl": "https://cdn.example.com/logo.png",
    "overlayPosition": "bottom-left",
    "overlayScale": 0.15,
    "pathPrefix": "test/overlay",
    "publicUrl": "https://assets.vicsee.com"
  }'
```

### Expected response

```json
{
  "url": "https://assets.vicsee.com/test/overlay/2026-02-08-abc123/job456.mp4"
}
```

---

*Created: 2026-02-08*
*Status: Planning — ready for implementation*
