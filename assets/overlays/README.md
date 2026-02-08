# Overlay Assets

PNG images bundled into the Docker image for use with `POST /video/overlay`.

## Files

| File | Source | Description |
|------|--------|-------------|
| `vicsee.png` | `vicsee-v2/src/shared/assets/watermark.png` | VicSee.com branding (7.5 KB) |

## Adding a New Overlay

1. Place the PNG file here: `assets/overlays/{name}.png`
2. The PNG must have a transparent background
3. Rebuild and deploy the Docker image
4. Callers reference it as `overlayAsset: "{name}"`

## Regenerating VicSee PNG

```bash
cd /path/to/vicsee-v2
node scripts/generate-watermark.mjs
cp scripts/watermark.png /path/to/ffmpeg-rest/assets/overlays/vicsee.png
```

## Notes

- Overlays are scaled at runtime via FFmpeg (relative to video width)
- All styling (fonts, shadows, colors) is baked into the PNG
- No font dependencies needed — purely image compositing
