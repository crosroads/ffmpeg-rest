# FFmpeg REST API — Multi-Project Video Processing Service

This fork of [crisog/ffmpeg-rest](https://github.com/crisog/ffmpeg-rest) adds custom video processing endpoints for multiple projects. Original fork endpoints are preserved and unmodified.

**Projects using this service:**
- **EasyBrainrot / VicSee** — brainrot video composition, video watermarking, video probing

---

## Custom Endpoints (Added by Us)

These are the endpoints we built on top of the original fork. Original endpoints (video convert, extract audio, extract frames, image convert, media probe) are unchanged.

### `POST /video/compose` — Brainrot Video Composition

Full video composition: background video + TTS audio + karaoke captions + watermark + background music.

| Detail | Value |
|--------|-------|
| Added | November 2025 |
| Consumer | EasyBrainrot, VicSee (brainrot tools) |
| Queue | Yes (BullMQ) |
| Processing time | 15-120s depending on duration |
| Full spec | [API-REFERENCE.md](./API-REFERENCE.md) |

Features:
- Word-by-word karaoke caption highlighting (ASS subtitles)
- Background video caching (first download ~30-60s, subsequent = instant)
- Text watermark (drawtext) or image watermark (overlay)
- Background music mixing with configurable volume
- 9 watermark positions, configurable opacity/scale
- Multi-project S3/R2 path prefix support

---

### `POST /video/overlay` — PNG Image Overlay

Composites a PNG image onto any video. Used for brand watermarking.

| Detail | Value |
|--------|-------|
| Added | February 8, 2026 |
| Consumer | VicSee (video watermark system) |
| Queue | Yes (BullMQ) |
| Processing time | 2-8s |
| Full spec | [20260208-VIDEO-OVERLAY-ENDPOINT.md](./20260208-VIDEO-OVERLAY-ENDPOINT.md) |
| Updates | [20260213-OVERLAY-SCALE-UPDATE.md](./20260213-OVERLAY-SCALE-UPDATE.md) |
| VicSee task | #04i Universal Watermark, #55 Watermark Conversion Upgrade |

Key differences from `/video/compose`:
- Input: video URL + PNG (not background + audio + subtitles)
- Audio: copy codec (passthrough, no re-encoding)
- No captions or music mixing
- Much faster (2-8s vs 15-120s)

Scaling uses ffprobe to probe both video and overlay dimensions, then calculates exact pixel sizes for proportional scaling relative to video width.

---

### `GET /video/probe` — Video Metadata Probe (PLANNED)

Probes a remote video URL and returns duration, width, height. Uses ffprobe on the URL directly — reads only container metadata, does not download the full video.

| Detail | Value |
|--------|-------|
| Status | **Spec only — not yet implemented** |
| Consumer | VicSee public API (Topaz video upscale billing) |
| Queue | No (inline, <1s) |
| Full spec | [20260213-VIDEO-PROBE-ENDPOINT.md](./20260213-VIDEO-PROBE-ENDPOINT.md) |
| VicSee task | #50 Topaz Upscale API |

---

## Original Fork Endpoints (Unmodified)

These came with the [crisog/ffmpeg-rest](https://github.com/crisog/ffmpeg-rest) template. We do not modify these.

| Endpoint | Purpose |
|----------|---------|
| `POST /video/convert` | Convert video to MP4 (file upload, returns file) |
| `POST /video/convert/url` | Convert video to MP4 (file upload, returns S3 URL) |
| `POST /video/audio` | Extract audio from video (returns WAV file) |
| `POST /video/audio/url` | Extract audio from video (returns S3 URL) |
| `POST /video/frames` | Extract frames from video (returns archive) |
| `POST /video/frames/url` | Extract frames from video (returns S3 URL) |
| `POST /audio/mp3` | Convert audio to MP3 |
| `POST /audio/wav` | Convert audio to WAV |
| `POST /image/jpg` | Convert image to JPG (returns file) |
| `POST /image/jpg/url` | Convert image to JPG (returns S3 URL) |
| `POST /media/info` | Probe uploaded media file (multipart upload) |

---

## Deployment

**Environment:** Railway (Production)
- **Server:** Node 22, Port 8080
- **Worker:** 5 concurrent BullMQ jobs
- **Redis:** BullMQ queue backend
- **R2 Storage:** Cloudflare R2 (no egress fees)

See [DEPLOYMENT-STATUS.md](./DEPLOYMENT-STATUS.md) for infrastructure details.

---

## Documentation Index

### Setup & Operations
| Doc | Purpose |
|-----|---------|
| [CUSTOMIZATION-GUIDE.md](./CUSTOMIZATION-GUIDE.md) | Step-by-step setup and deployment |
| [QUICK-START.md](./QUICK-START.md) | TL;DR command reference |
| [DEPLOYMENT-STATUS.md](./DEPLOYMENT-STATUS.md) | Current production state |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and fixes |

### Endpoint Specs
| Doc | Endpoint | Status |
|-----|----------|--------|
| [API-REFERENCE.md](./API-REFERENCE.md) | `POST /video/compose` | Live |
| [20260208-VIDEO-OVERLAY-ENDPOINT.md](./20260208-VIDEO-OVERLAY-ENDPOINT.md) | `POST /video/overlay` | Live |
| [20260213-VIDEO-PROBE-ENDPOINT.md](./20260213-VIDEO-PROBE-ENDPOINT.md) | `GET /video/probe` | Planned |

### Technical Deep-Dives
| Doc | Topic |
|-----|-------|
| [CAPTION-SYSTEM.md](./CAPTION-SYSTEM.md) | ASS subtitle karaoke implementation |
| [WATERMARK-BOX-FEATURE.md](./WATERMARK-BOX-FEATURE.md) | Watermark background box |
| [20260213-OVERLAY-SCALE-UPDATE.md](./20260213-OVERLAY-SCALE-UPDATE.md) | Overlay scale 0.35 to 0.22 + ffprobe migration |

### Bug Fixes
| Doc | Issue |
|-----|-------|
| [CRITICAL-FIX-BACKGROUND-CROPPING.md](./CRITICAL-FIX-BACKGROUND-CROPPING.md) | Background video aspect ratio fix |
| [FIX-NARROW-VIDEO-SCALING.md](./FIX-NARROW-VIDEO-SCALING.md) | Narrow portrait video handling |

---

## Features

| Feature | Original Fork | Custom (Ours) |
|---------|--------------|---------------|
| Video to MP4 | Yes | - |
| Extract Audio | Yes | - |
| Extract Frames | Yes | - |
| Image to JPG | Yes | - |
| Media Probe (file upload) | Yes | - |
| **Video Composition (brainrot)** | - | Yes |
| **Karaoke Captions** | - | Yes |
| **PNG Image Overlay** | - | Yes |
| **Text Watermark (drawtext)** | - | Yes |
| **Background Music Mixing** | - | Yes |
| **Video Probe (URL-based)** | - | Planned |
| S3/R2 Storage | Yes | Extended (multi-project paths) |
| Job Queue (BullMQ) | Yes | Yes |
| API Authentication | Yes | Yes |

---

## Cost

**Railway:** ~$5-10/month base, ~$0.003 per video composition
**Cloudflare R2:** Free (first 10GB storage, $0 egress)

---

## Changelog

| Date | Change | Commits |
|------|--------|---------|
| Nov 2025 | Initial fork + `/video/compose` endpoint | Multiple |
| Feb 8, 2026 | `POST /video/overlay` endpoint | `b8de1cd` |
| Feb 13, 2026 | Overlay scale 0.35 to 0.22, bold PNG, ffprobe scaling | `2bdfae3`, `af8d147` |
| Feb 13, 2026 | `GET /video/probe` spec written | - |

---

**Status:** Live on Railway
**Last Updated:** February 13, 2026
