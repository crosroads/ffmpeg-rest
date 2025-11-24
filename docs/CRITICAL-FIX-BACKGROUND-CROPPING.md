# Critical Fix: Background Video Cropping for Portrait Output

**Date:** November 24, 2025
**Severity:** 🔴 Critical - Blocks Production Use
**Status:** 📝 Documented - Ready for Implementation

---

## 🐛 Problem Description

### **Issue:**
Background videos are being stretched/distorted when composed into portrait (9:16) output videos.

### **Visual Evidence:**
![Distorted Background Example](../easybrainrot/docs/screenshots/distorted-subway-surfer.png)

**Observable Symptoms:**
- Landscape videos (1920x1080) stretched vertically into portrait (1080x1920)
- Characters and objects appear compressed/squashed
- Proportions are completely wrong
- Unacceptable visual quality

### **Root Cause:**
Current FFmpeg filter only trims duration without scaling/cropping:
```typescript
// Current code (Line 438 in processor.ts)
filterComplex += `[0:v]trim=duration=${duration}[bg];`;
```

This assumes the background video is already in the correct aspect ratio, which is FALSE for landscape videos.

---

## ✅ Solution

### **Fix: Add Scale + Crop to Portrait Ratio**

**Implementation:**
```typescript
// BEFORE (Line 438):
filterComplex += `[0:v]trim=duration=${duration}[bg];`;

// AFTER (Line 438):
const [targetWidth, targetHeight] = resolution.split('x').map(Number); // e.g., 1080, 1920
filterComplex += `[0:v]scale=-1:${targetHeight},crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;
```

### **How It Works:**

**Step 1: Scale to target height**
```
scale=-1:1920
```
- Scales video to 1920px height
- `-1` maintains aspect ratio (auto-calculates width)
- Example: 1920x1080 → 3413x1920 (maintains 16:9 ratio)

**Step 2: Crop to target width**
```
crop=1080:1920
```
- Crops from center to 1080x1920 (9:16 portrait)
- Takes middle 1080px of the 3413px width
- Result: Perfect portrait video with no distortion

**Step 3: Trim duration**
```
trim=duration=45
```
- Limits video to specified duration
- Same as before

### **Visual Transformation:**

```
Original Landscape (1920x1080 - 16:9):
┌──────────────────────────────────────┐
│                                      │
│         Subway Surfer Gameplay       │
│                                      │
└──────────────────────────────────────┘

After scale=-1:1920 (3413x1920):
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              Subway Surfer Gameplay (scaled)               │
│                                                            │
└────────────────────────────────────────────────────────────┘

After crop=1080:1920 (Portrait 9:16):
          ┌──────────────────┐
          │                  │
          │                  │
          │  Subway Surfer   │
          │    Gameplay      │
          │   (centered)     │
          │                  │
          │                  │
          └──────────────────┘
```

---

## 📐 Technical Specifications

### **File Location:**
```
../ffmpeg-rest/src/queue/video/processor.ts
Line: 438
Function: composeVideo()
```

### **Code Context:**
```typescript
// Around line 430-445
if (backgroundUrl) {
  console.log('[FFmpeg] Adding background video');

  // Parse target resolution
  const [targetWidth, targetHeight] = resolution.split('x').map(Number);

  // Scale to target height, crop to target width, then trim
  filterComplex += `[0:v]scale=-1:${targetHeight},crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;

  // ... rest of filter chain
}
```

### **Parameters:**
- `resolution`: String, e.g., `"1080x1920"` (portrait), `"1920x1080"` (landscape)
- `targetWidth`: Number, e.g., `1080`
- `targetHeight`: Number, e.g., `1920`
- `duration`: Number, video duration in seconds

### **FFmpeg Filter Chain:**
```bash
scale=-1:1920           # Scale to target height (maintain aspect ratio)
  ↓
crop=1080:1920         # Crop to portrait dimensions (center crop)
  ↓
trim=duration=45       # Trim to specified duration
  ↓
[bg]                   # Label as background stream
```

---

## 🧪 Testing Plan

### **Test Case 1: Landscape Background → Portrait Output**
**Input:**
- Background: `subway-surfer-2.mp4` (1920x1080)
- Target: `1080x1920` (portrait)
- Duration: 45 seconds

**Expected Output:**
- Video: 1080x1920 (portrait)
- No stretching/distortion
- Center-cropped from landscape
- Character proportions correct

### **Test Case 2: Portrait Background → Portrait Output**
**Input:**
- Background: `portrait-gameplay.mp4` (1080x1920)
- Target: `1080x1920` (portrait)
- Duration: 45 seconds

**Expected Output:**
- Video: 1080x1920 (portrait)
- No scaling needed (already portrait)
- Crop may adjust if aspect ratios differ slightly
- No distortion

### **Test Case 3: Square Background → Portrait Output**
**Input:**
- Background: `square-video.mp4` (1080x1080)
- Target: `1080x1920` (portrait)
- Duration: 45 seconds

**Expected Output:**
- Video: 1080x1920 (portrait)
- Scaled up to 1920x1920
- Cropped to 1080x1920 (center)
- Letterboxing if needed

---

## 🔄 Comparison: Before vs After

### **Before Fix:**
```typescript
filterComplex += `[0:v]trim=duration=${duration}[bg];`;
```
**Result:** Stretched/distorted video ❌

**FFmpeg Command:**
```bash
ffmpeg -i background.mp4 \
  -filter_complex "[0:v]trim=duration=45[bg]" \
  ...
```

### **After Fix:**
```typescript
const [targetWidth, targetHeight] = resolution.split('x').map(Number);
filterComplex += `[0:v]scale=-1:${targetHeight},crop=${targetWidth}:${targetHeight},trim=duration=${duration}[bg];`;
```
**Result:** Properly cropped portrait video ✅

**FFmpeg Command:**
```bash
ffmpeg -i background.mp4 \
  -filter_complex "[0:v]scale=-1:1920,crop=1080:1920,trim=duration=45[bg]" \
  ...
```

---

## 📊 Impact Analysis

### **Affected Systems:**
- ✅ Video composition service (this fix)
- ✅ Thumbnail generation (already fixed in previous commit)

### **Affected Users:**
- All users generating brainrot videos with landscape backgrounds
- Approximately 80% of backgrounds are landscape (Subway Surfer, Minecraft Parkour, etc.)

### **Priority Justification:**
- 🔴 Critical: Makes videos unusable
- 🔴 Blocks: Cannot ship to production with this bug
- 🔴 User Impact: Poor quality = bad reviews/churn
- 🟢 Simple Fix: 2-line code change
- 🟢 Low Risk: Same fix already proven in thumbnail generation

---

## 🚀 Deployment Plan

### **Step 1: Local Testing**
```bash
cd ../ffmpeg-rest

# Apply fix to processor.ts
# Test with local FFmpeg installation

npm run test:compose  # Run composition tests
```

### **Step 2: Verify Build**
```bash
npm run build
# Ensure TypeScript compilation succeeds
```

### **Step 3: Deploy to Railway**
```bash
git add src/queue/video/processor.ts
git commit -m "fix(video): Add scale+crop for background videos to prevent distortion"
git push origin main
# Railway auto-deploys
```

### **Step 4: Integration Test**
```bash
# From easybrainrot repo
curl -X POST https://ffmpeg-rest-production-6ad7.up.railway.app/video/compose \
  -H "Content-Type: application/json" \
  -d @test-background-crop.json
```

### **Step 5: Verify Output**
- Download generated video
- Check aspect ratio (should be 1080x1920)
- Verify no distortion
- Confirm character proportions correct

---

## 📝 Related Issues

### **Previous Fix (Thumbnail Generation):**
**Commit:** Day 11 - Thumbnail generation fix
**File:** `src/services/thumbnail-generator.ts`
**Issue:** Same distortion problem with thumbnails
**Fix:** Added scale + crop logic

### **Why This Wasn't Caught Earlier:**
- Thumbnail generation was fixed first
- Video composition shares same logic but in different file
- Need to apply same fix to video processor

---

## ✅ Success Criteria

- [ ] Background videos scaled to target height
- [ ] Background videos cropped to target width
- [ ] No stretching or distortion visible
- [ ] Character proportions correct (e.g., not squashed)
- [ ] Works for all background types (landscape, portrait, square)
- [ ] FFmpeg command executes without errors
- [ ] Output video plays correctly
- [ ] Integration tests pass

---

## 🔗 References

### **FFmpeg Documentation:**
- [Scale Filter](https://ffmpeg.org/ffmpeg-filters.html#scale)
- [Crop Filter](https://ffmpeg.org/ffmpeg-filters.html#crop)
- [Trim Filter](https://ffmpeg.org/ffmpeg-filters.html#trim)

### **Related Code:**
- `src/queue/video/processor.ts` (line 438) - Video composition
- `src/services/thumbnail-generator.ts` - Thumbnail generation (already fixed)

### **Test Files:**
- `test-background-crop.json` - Test payload for Railway
- Screenshot: `../easybrainrot/docs/screenshots/distorted-subway-surfer.png`

---

## 🎯 Expected Outcome

After this fix:
- ✅ Landscape backgrounds (Subway Surfer, Minecraft) display correctly in portrait
- ✅ Center-crop preserves most important visual elements
- ✅ No distortion or stretching
- ✅ Professional video quality
- ✅ Ready for production deployment

**Estimated Time:** 30 minutes (fix + test + deploy)

---

**Last Updated:** November 24, 2025
**Assignee:** Claude Code
**Status:** Ready for Implementation
