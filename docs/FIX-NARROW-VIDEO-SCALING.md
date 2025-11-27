# Fix: Narrow Video Scaling for Portrait Output

**Date:** November 27, 2025
**Severity:** 🔴 Critical - Causes video composition failures
**Status:** ✅ Fixed

---

## 🐛 Problem Description

### **Issue:**
Video composition fails when using narrow portrait videos (e.g., 606x1080) as backgrounds for 1080x1920 output.

### **Error Message:**
```
[Parsed_crop_4 @ 0x7f42a2991980] Invalid too big or non positive size for width '1080' or height '1920'
[Parsed_crop_4 @ 0x7f42a2991980] Failed to configure input pad on Parsed_crop_4
```

### **Root Cause:**
The original FFmpeg filter scales by height only:
```
scale=-1:1920,crop=1080:1920
```

For a 606x1080 video:
- After `scale=-1:1920`: becomes **1077x1920** (606 × 1920/1080 = 1077)
- `crop=1080:1920` **FAILS** because 1077 < 1080 (not enough width to crop)

### **Affected Videos:**
Any video where: `width × (target_height / height) < target_width`

For 1080x1920 target, minimum source aspect ratio: 1080/1920 = 0.5625 (9:16)

| Video | Dimensions | Aspect Ratio | Scaled Width | Status |
|-------|------------|--------------|--------------|--------|
| surfer-1 | 1360x720 | 1.89 (landscape) | 3627 | ✅ OK |
| surfer-2 | 606x1080 | 0.56 (narrow portrait) | 1077 | ❌ BROKEN |
| surfer-3 | 1360x720 | 1.89 | 3627 | ✅ OK |
| surfer-4 | 606x1080 | 0.56 | 1077 | ❌ BROKEN |
| surfer-5 | 1360x720 | 1.89 | 3627 | ✅ OK |
| surfer-6 | 606x1080 | 0.56 | 1077 | ❌ BROKEN |
| surfer-7 | 1138x594 | 1.92 | 3678 | ✅ OK |
| surfer-8 | 606x1080 | 0.56 | 1077 | ❌ BROKEN |
| surfer-9 | 1360x720 | 1.89 | 3627 | ✅ OK |
| surfer-10 | 606x1080 | 0.56 | 1077 | ❌ BROKEN |
| surfer-11 | 606x1080 | 0.56 | 1077 | ❌ BROKEN |

---

## ✅ Solution

### **Fix: Use `force_original_aspect_ratio=increase`**

**Before (broken):**
```typescript
filterComplex += `[0:v]scale=-1:${targetHeight},crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;
```

**After (fixed):**
```typescript
filterComplex += `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;
```

### **How It Works:**

**`force_original_aspect_ratio=increase`** scales the video to **cover** the target dimensions (not fit). This ensures at least one dimension matches exactly, while the other dimension exceeds the target.

**Example 1: Narrow Portrait (606x1080) → 1080x1920**
```
Original:     606x1080 (aspect 0.56)
Target:       1080x1920 (aspect 0.56)
After scale:  1080x1920 (scaled by width factor: 1080/606 = 1.78)
After crop:   1080x1920 ✅
```

**Example 2: Landscape (1360x720) → 1080x1920**
```
Original:     1360x720 (aspect 1.89)
Target:       1080x1920 (aspect 0.56)
After scale:  3627x1920 (scaled by height factor: 1920/720 = 2.67)
After crop:   1080x1920 ✅ (center crop from 3627 width)
```

**Example 3: Square (1080x1080) → 1080x1920**
```
Original:     1080x1080 (aspect 1.0)
Target:       1080x1920 (aspect 0.56)
After scale:  1920x1920 (scaled by height factor: 1920/1080 = 1.78)
After crop:   1080x1920 ✅ (center crop)
```

### **Visual Transformation:**

```
Narrow Portrait (606x1080):
┌─────────┐
│         │
│         │
│  Video  │
│         │
│         │
└─────────┘
     ↓ scale=1080:1920:force_original_aspect_ratio=increase
┌─────────────────┐
│                 │
│                 │
│   Scaled Up     │
│                 │
│                 │
└─────────────────┘
     ↓ crop=1080:1920 (no crop needed, exact fit)
┌─────────────────┐
│                 │
│                 │
│     Final       │
│                 │
│                 │
└─────────────────┘


Landscape (1360x720):
┌──────────────────────────────────┐
│           Video                  │
└──────────────────────────────────┘
     ↓ scale=1080:1920:force_original_aspect_ratio=increase
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│                    Scaled Up                             │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
     ↓ crop=1080:1920 (center crop)
          ┌─────────────────┐
          │                 │
          │                 │
          │     Final       │
          │   (centered)    │
          │                 │
          └─────────────────┘
```

---

## 📐 Technical Details

### **File Location:**
```
src/queue/video/processor.ts
Line: ~439 (in composeVideo function)
```

### **FFmpeg Filter Comparison:**

**Old filter chain:**
```bash
[0:v]scale=-1:1920,crop=1080:1920,trim=duration=45[bg]
```
- Scales height to 1920, width auto-calculated
- Assumes result width >= 1080 (fails for narrow videos)

**New filter chain:**
```bash
[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=duration=45[bg]
```
- Scales to cover 1080x1920 (at least one dimension matches, other may exceed)
- Guarantees enough pixels for crop
- Works for ANY input aspect ratio

### **FFmpeg Documentation:**
- [scale filter - force_original_aspect_ratio](https://ffmpeg.org/ffmpeg-filters.html#scale)
  - `increase`: Scale to cover the output size, maintaining aspect ratio
  - `decrease`: Scale to fit within the output size (letterbox)

---

## 🧪 Testing

### **Test Case 1: Narrow Portrait**
```bash
# Input: 606x1080 video
ffmpeg -i narrow.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -t 5 output.mp4
# Expected: 1080x1920 output, no distortion
```

### **Test Case 2: Landscape**
```bash
# Input: 1360x720 video
ffmpeg -i landscape.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -t 5 output.mp4
# Expected: 1080x1920 output, center-cropped
```

### **Test Case 3: Square**
```bash
# Input: 1080x1080 video
ffmpeg -i square.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -t 5 output.mp4
# Expected: 1080x1920 output, vertically cropped
```

---

## 🔄 Migration Notes

- No API changes required
- Backwards compatible - existing videos will continue to work
- Previously broken videos (606x1080) will now work
- No database migrations needed

---

## ✅ Success Criteria

- [x] Narrow portrait videos (606x1080) compose successfully
- [x] Landscape videos continue to work
- [x] Square videos continue to work
- [x] No distortion in output
- [x] Center crop preserves important content
- [x] All existing tests pass

---

**References:**
- Previous fix: `docs/CRITICAL-FIX-BACKGROUND-CROPPING.md`
- FFmpeg scale docs: https://ffmpeg.org/ffmpeg-filters.html#scale
