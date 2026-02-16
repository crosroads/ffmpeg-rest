# Overlay Scale Update — #55 Watermark Conversion Upgrade

> Date: February 13, 2026
> VicSee Task: [#55 — Watermark Conversion Upgrade](../../../vicsee-v2/docs/product/tasks/20260205-q1-roadmap/55-watermark-conversion-upgrade.md)
> Commits: `2bdfae3`, `f11f5ad`, `af8d147`

---

## What Changed

Three changes to `POST /video/overlay` in a single session:

### 1. Default scale reduced: 0.35 → 0.22

The `overlayScale` default was lowered from 35% to 22% of video width.

**Why:** User testing on real VicSee generations showed that 35% was too aggressive for AI-generated videos (720p output from Kie). The watermark dominated the frame and looked unprofessional. 22% is prominent enough for brand attribution without being distracting.

**Impact:** Only affects requests that omit `overlayScale`. Existing callers that explicitly pass `overlayScale: 0.35` are unaffected.

### 2. Watermark PNG replaced: ghost → bold V4

Replaced `assets/overlays/vicsee.png` (7.5 KB ghost watermark) with a bolder V4 design (30 KB). The new PNG has:
- Stronger contrast and thicker strokes
- Better visibility at smaller scales (compensates for the 0.35→0.22 reduction)
- Transparent background preserved

### 3. Scaling method: `iw*scale` → `ffprobe` + explicit pixel dimensions

**Before (broken):**
```
[1:v]scale=iw*0.22:-1[ovl]
```
This scaled relative to the overlay's own width (`iw`), not the video width. A 500px-wide overlay at 0.22 = 110px — far too small on a 1280px video.

**After (fixed, commit `2bdfae3`):**
```
[1:v]scale2ref=main_w*0.22:-1:main_w:main_h[ovl][ref]
```
Used `scale2ref` to scale relative to the main video dimensions. This was then immediately replaced again:

**Final (commit `af8d147`):**
```
// Probe both video and overlay dimensions
ffprobe → videoWidth, videoHeight
ffprobe → ovlWidth, ovlHeight

// Calculate exact pixel sizes
targetWidth = round(videoWidth * overlayScale)
targetHeight = round((targetWidth * ovlHeight) / ovlWidth)

// Use explicit scale
[1:v]scale={targetWidth}:{targetHeight}[ovl]
```

**Why the second fix?** `scale2ref` is deprecated in FFmpeg 8+ and produced incorrect aspect ratios with `-1` height on some Docker images. Using `ffprobe` + explicit pixel dimensions is future-proof and gives exact control.

---

## Files Changed

| File | Change |
|------|--------|
| `assets/overlays/vicsee.png` | Replaced: ghost (7.5KB) → bold V4 (30KB) |
| `src/queue/video/processor.ts` | Scaling: `iw*scale` → ffprobe + explicit pixels |
| `src/utils/overlay-positions.ts` | Margins: support fractional values (0.03 = 3% of W/H) |

---

## Updated Defaults

| Parameter | Before | After |
|-----------|--------|-------|
| `overlayScale` | 0.35 | **0.22** |
| Scaling method | `iw*{scale}` | ffprobe + `scale={px}:{px}` |
| Margin format | Pixels only | Pixels (≥1) or fractions (<1) |

---

## Testing

Tested on 720p Kie video output (1280×720):
- 0.22 scale → 282px overlay width → visible but not dominant
- 0.30 scale → 384px → acceptable alternative
- 0.35 scale → 448px → too large (original default)

---

*Created: 2026-02-13*
*Status: Deployed*
