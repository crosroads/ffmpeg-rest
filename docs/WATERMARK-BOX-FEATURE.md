# Watermark Background Box Feature

**Date:** November 27, 2025
**Feature:** Add semi-transparent background box behind watermark text
**Status:** 📋 Planned
**Priority:** Medium
**Related:** easybrainrot `WATERMARK-VISIBILITY-IMPROVEMENT.md`

---

## Summary

Add support for FFmpeg's `drawtext` box parameter to render a semi-transparent background behind the watermark text. This improves visibility on busy video backgrounds (Minecraft, Subway Surfers) without being overly intrusive.

---

## New API Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `watermarkBoxEnabled` | boolean | `false` | Enable background box behind watermark |
| `watermarkBoxColor` | string | `'#000000'` | Box color (hex) |
| `watermarkBoxOpacity` | number | `0.3` | Box opacity (0.0-1.0) |
| `watermarkBoxPadding` | number | `6` | Padding around text in pixels |

---

## Implementation

### 1. Update Schemas

**File:** `src/queue/video/schemas.ts`

Add to Zod schema:
```typescript
watermarkBoxEnabled: z.boolean().optional().default(false),
watermarkBoxColor: z.string().optional().default('#000000'),
watermarkBoxOpacity: z.number().min(0).max(1).optional().default(0.3),
watermarkBoxPadding: z.number().optional().default(6),
```

**File:** `src/components/video/schemas.ts`

Add to OpenAPI schema:
```typescript
watermarkBoxEnabled: {
  type: 'boolean',
  description: 'Enable background box behind watermark',
  default: false,
},
watermarkBoxColor: {
  type: 'string',
  description: 'Box background color (hex)',
  default: '#000000',
},
watermarkBoxOpacity: {
  type: 'number',
  description: 'Box opacity (0.0-1.0)',
  default: 0.3,
},
watermarkBoxPadding: {
  type: 'number',
  description: 'Padding around text in pixels',
  default: 6,
},
```

### 2. Update Controller

**File:** `src/components/video/controller.ts`

Pass new parameters to job queue:
```typescript
const job = await addJob(JobType.VIDEO_COMPOSE, {
  // ... existing params
  watermarkBoxEnabled: body.watermarkBoxEnabled,
  watermarkBoxColor: body.watermarkBoxColor,
  watermarkBoxOpacity: body.watermarkBoxOpacity,
  watermarkBoxPadding: body.watermarkBoxPadding,
});
```

### 3. Update Processor

**File:** `src/queue/video/processor.ts`

Modify drawtext filter to include box parameters:

```typescript
// Current filter (without box):
const drawtextFilter = `drawtext=fontfile='${fontFamily}\\:style=${fontStyle}':text='${escapedText}':fontsize=${watermarkFontSize}:fontcolor=${fontColor}:borderw=${watermarkBorderWidth}:bordercolor=${borderColor}:x=${textPosition.x}:y=${textPosition.y}`;

// New filter (with box support):
let drawtextFilter = `drawtext=fontfile='${fontFamily}\\:style=${fontStyle}':text='${escapedText}':fontsize=${watermarkFontSize}:fontcolor=${fontColor}:borderw=${watermarkBorderWidth}:bordercolor=${borderColor}:x=${textPosition.x}:y=${textPosition.y}`;

// Add box if enabled
if (watermarkBoxEnabled) {
  const boxColor = hexToFFmpegColor(watermarkBoxColor, watermarkBoxOpacity);
  drawtextFilter += `:box=1:boxcolor=${boxColor}:boxborderw=${watermarkBoxPadding}`;
}
```

**FFmpeg box parameter syntax:**
- `box=1` - Enable box
- `boxcolor=black@0.3` - Color with opacity (can also use hex: `0x000000@0.3`)
- `boxborderw=6` - Padding around text (acts as box border width)

---

## Example FFmpeg Filter

**Without box (current):**
```bash
drawtext=fontfile='Liberation Sans\:style=Bold':text='EasyBrainrot.com':fontsize=40:fontcolor=0xFFD700D9:borderw=1:bordercolor=0x000000D9:x=(w-text_w)/2:y=h-text_h-400
```

**With box (new):**
```bash
drawtext=fontfile='Liberation Sans\:style=Bold':text='EasyBrainrot.com':fontsize=40:fontcolor=0xFFD700D9:borderw=1:bordercolor=0x000000D9:x=(w-text_w)/2:y=h-text_h-400:box=1:boxcolor=0x0000004D:boxborderw=6
```

Note: `0x0000004D` = black at 30% opacity (0x4D ≈ 77/255 ≈ 0.3)

---

## Testing

### Local Test Command
```bash
curl -X POST http://localhost:3000/video/compose \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundUrl": "https://example.com/bg.mp4",
    "audioUrl": "https://example.com/audio.mp3",
    "watermarkText": "EasyBrainrot.com",
    "watermarkFontSize": 40,
    "watermarkBoxEnabled": true,
    "watermarkBoxColor": "#000000",
    "watermarkBoxOpacity": 0.3,
    "watermarkBoxPadding": 6,
    ...
  }'
```

### Validation Checklist
- [ ] Box renders behind text
- [ ] Box opacity is correct (30% = subtle)
- [ ] Box padding creates breathing room
- [ ] Box works with all background types
- [ ] Backward compatible (box disabled by default)

---

## Rollback

If issues arise:
1. Set `watermarkBoxEnabled: false` in easybrainrot client
2. No API changes needed (parameter is optional)

---

## References

- [FFmpeg drawtext filter](https://ffmpeg.org/ffmpeg-filters.html#drawtext)
- easybrainrot: `docs/execution/easybrainrot/reference/WATERMARK-VISIBILITY-IMPROVEMENT.md`

---

**Document Version:** 1.0
**Last Updated:** November 27, 2025
