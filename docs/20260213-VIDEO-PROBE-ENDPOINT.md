# Video Probe Endpoint — Implementation Spec

> `GET /video/probe` — Probe a remote video URL and return metadata (duration, width, height).
> Date: February 13, 2026
> VicSee Task: [#50 — Topaz Upscale API](../../../vicsee-v2/docs/product/tasks/20260205-q1-roadmap/50-topaz-upscale-api.md)
> Status: **✅ Implemented (Feb 14, 2026)**

---

## Why This Endpoint Exists

VicSee charges credits **upfront** before submitting work to upstream providers. For Topaz video upscale, the credit cost depends on video duration (per-second billing). VicSee's public API receives a video URL from the developer — it needs to know the duration before charging.

This endpoint uses `ffprobe` (already available on Railway via the FFmpeg installation) to read video container metadata from a remote URL without downloading the entire file.

**This is NOT the same as `POST /media/info`** (original fork endpoint). That endpoint requires multipart file upload. This endpoint takes a URL — no file upload needed.

---

## Endpoint

### `GET /video/probe`

**Tags:** `Video`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URL) | **Yes** | Remote video URL to probe |

### Response

**200 OK:**
```json
{
  "duration": 8.5,
  "width": 1920,
  "height": 1080
}
```

| Field | Type | Description |
|-------|------|-------------|
| `duration` | number | Video duration in seconds (float) |
| `width` | number | Video width in pixels |
| `height` | number | Video height in pixels |

**400 Bad Request:**
```json
{
  "error": "url query parameter is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Probe failed: <details>"
}
```

---

## Implementation

### ffprobe Command

```bash
ffprobe -v quiet -print_format json -show_format -show_streams {url}
```

This reads only the video container metadata (moov atom / header) — it does NOT download the full video file. Typical response time: <1 second.

### Extracting Fields

From the ffprobe JSON output:
- `duration` → `format.duration` (string, parse to float)
- `width` → first video stream's `streams[].width` where `codec_type === "video"`
- `height` → first video stream's `streams[].height` where `codec_type === "video"`

### Example Implementation

```typescript
// In src/components/video/controller.ts

app.openapi(videoProbeRoute, async (c) => {
  const { url } = c.req.valid('query');

  if (!url) {
    return c.json({ error: 'url query parameter is required' }, 400);
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      url
    ], { timeout: 30000 });

    const probe = JSON.parse(stdout);
    const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video');

    if (!videoStream) {
      return c.json({ error: 'No video stream found' }, 400);
    }

    return c.json({
      duration: parseFloat(probe.format?.duration || '0'),
      width: videoStream.width,
      height: videoStream.height
    }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return c.json({ error: `Probe failed: ${msg}` }, 500);
  }
});
```

### No Queue Needed

Unlike other endpoints (`/video/compose`, `/video/overlay`), probing is lightweight and fast (<1s). It does NOT need to go through the BullMQ queue — it can run inline in the request handler.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/video/schemas.ts` | Modify | Add `videoProbeRoute` OpenAPI route definition |
| `src/components/video/controller.ts` | Modify | Add `GET /video/probe` handler (inline, no queue) |

**Total:** 2 files modified, ~40 lines added.

---

## Comparison with Existing Probe Endpoints

| Aspect | `POST /media/info` (original fork) | `GET /video/probe` (new) |
|--------|-------------------------------------|--------------------------|
| Input | Multipart file upload | URL query parameter |
| Processing | BullMQ queue job | Inline (no queue) |
| Use case | Uploaded files | Remote URLs |
| Consumer | Generic media tool | VicSee public API billing |
| Speed | Depends on upload size | <1s (metadata only) |

---

## Consumer: VicSee Public API

VicSee's `POST /api/v1/generate` route calls this endpoint when processing Topaz video upscale requests:

```typescript
// In VicSee's public API route
if (model === 'topaz-video-upscale') {
  const probe = await fetch(
    `${RAILWAY_URL}/video/probe?url=${encodeURIComponent(video_url)}`
  ).then(r => r.json());

  const duration = Math.ceil(probe.duration);
  if (duration < 1 || duration > 60) throw new Error('Video must be 1-60 seconds');

  const creditsPerSecond = upscale_factor === '4' ? 28 : 16;
  const totalCredits = creditsPerSecond * duration;
  // Charge totalCredits, then submit to Kie
}
```

---

## Security Considerations

- The `url` parameter accepts any URL — ffprobe will attempt to read from it
- Consider adding URL validation (must be https, must end in video extension)
- Consider adding a timeout (30s max) to prevent hanging on slow/unresponsive URLs
- Bearer token authentication (if `BEARER_TOKENS` is configured) provides access control

---

*Created: 2026-02-13*
*Implemented: 2026-02-14 — `schemas.ts` (videoProbeRoute) + `controller.ts` (inline ffprobe handler)*
