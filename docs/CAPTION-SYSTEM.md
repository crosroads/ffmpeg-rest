# Caption System Architecture

**FFmpeg REST API - Brainrot-Style Caption Implementation**

**Date:** November 23, 2025
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [ASS Subtitle Format](#ass-subtitle-format)
3. [Phrase Segmentation](#phrase-segmentation)
4. [Inline Color Animations](#inline-color-animations)
5. [Timing Calculations](#timing-calculations)
6. [Font Installation](#font-installation)
7. [Performance Optimizations](#performance-optimizations)
8. [Code Deep Dive](#code-deep-dive)

---

## Overview

The caption system generates **brainrot-style** captions with word-by-word gold highlighting synchronized to audio. This creates a TikTok/Reels-style effect where each word lights up as it's spoken.

### Key Features

- **Phrase Segmentation**: Groups 2-3 words per dialogue (not per-word rendering)
- **Inline Animations**: Uses ASS `\t` transform tags for smooth color transitions
- **No Overlapping**: Single phrase visible at any moment (no text stacking)
- **Gold Highlighting**: White → Gold → White color transitions
- **First Word Special Case**: Starts highlighted (no white flash)
- **Natural Breaks**: 300ms gap detection for phrase boundaries

### Visual Effect

```
Phrase 1: "Full cap it's"
         [GOLD] [white] [white]  ← Frame 0ms
         [white] [GOLD] [white]  ← Frame 240ms
         [white] [white] [GOLD]  ← Frame 560ms

Phrase 2: "fake news bruh"
         [GOLD] [white] [white]  ← Frame 0ms (new phrase)
         ...
```

---

## ASS Subtitle Format

### What is ASS?

**ASS (Advanced SubStation Alpha)** is a subtitle format that supports:
- Karaoke effects (word-by-word highlighting)
- Inline style overrides (color, size, position)
- Animation tags (`\t` for time-based transformations)
- Precise timing (centisecond resolution)

### ASS File Structure

```
[Script Info]
Title: EasyBrainrot Captions
ScriptType: v4.00+
PlayResX: 1080          ← Video width
PlayResY: 1920          ← Video height

[V4+ Styles]
Style: Default,Liberation Sans,80,&H00FFFFFF,...
       ↑       ↑               ↑   ↑
       Name    Font            Size Color (BGR format)

[Events]
Dialogue: 0,0:00:00.00,0:00:01.18,Default,,0,0,0,,{animations}text
          ↑  ↑          ↑          ↑                ↑
          Layer Start   End        Style            Text with inline tags
```

### Color Format

ASS uses **&HAABBGGRR** format (BGR with alpha channel):

```typescript
// Hex: #FFD700 (gold)
// Convert: R=FF, G=D7, B=00
// ASS format: &H0000D7FF (00 = opaque, BGR order)

function colorToASS(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}
```

**Examples:**
- White `#FFFFFF` → `&H00FFFFFF`
- Gold `#FFD700` → `&H0000D7FF`
- Black `#000000` → `&H00000000`

---

## Phrase Segmentation

### Why Segmentation?

**Problem with per-word dialogues:**
- Multiple dialogues render simultaneously → overlapping text
- "Sliding window" approach shows prev+current+next → visual mess
- Timing conflicts at boundaries

**Solution: Phrase segmentation**
- Group 2-3 words into single dialogue
- Use inline `\t` tags for word highlighting
- Only ONE dialogue visible at a time

### Segmentation Algorithm

```typescript
function segmentWords(timestamps: WordTimestamp[], maxWordsPerSegment: number = 3) {
  const segments = [];
  let currentSegment = [];
  let segmentStartTime = 0;

  timestamps.forEach((timestamp, index) => {
    // Start new segment
    if (currentSegment.length === 0) {
      segmentStartTime = timestamp.start;
    }

    currentSegment.push(timestamp);

    // Check if we should close this segment
    const isLastWord = index === timestamps.length - 1;
    const segmentFull = currentSegment.length >= maxWordsPerSegment;
    const nextWordHasGap = !isLastWord &&
      timestamps[index + 1].start - timestamp.end > 0.3; // 300ms = natural pause

    if (isLastWord || segmentFull || nextWordHasGap) {
      segments.push({
        startTime: segmentStartTime,
        endTime: currentSegment[currentSegment.length - 1].end,
        words: [...currentSegment]
      });
      currentSegment = [];
    }
  });

  return segments;
}
```

### Example Segmentation

**Input:**
```json
[
  {"word": "Full", "start": 4.362, "end": 4.562},
  {"word": "cap", "start": 4.602, "end": 4.922},
  {"word": "it's", "start": 5.162, "end": 5.282},  ← 240ms gap after "cap"
  {"word": "fake", "start": 5.362, "end": 5.582},
  {"word": "news", "start": 5.622, "end": 5.922}
]
```

**Output:**
```javascript
Segment 1: {
  startTime: 4.362,
  endTime: 5.282,
  words: ["Full", "cap", "it's"]  // 3 words
}
Segment 2: {
  startTime: 5.362,
  endTime: 5.922,
  words: ["fake", "news"]  // 2 words (end of transcript)
}
```

---

## Inline Color Animations

### The `\t` Transform Tag

ASS `\t` tag syntax: `\t(startMs, endMs, \style)`

**CRITICAL:** Timing is **relative to dialogue start**, not absolute!

```
Dialogue starts at 4.362s (absolute)
Word "cap" starts at 4.602s (absolute)

Relative timing for "cap":
  4.602s - 4.362s = 0.240s = 240ms ✅
```

### Animation Pattern

**First word (index 0):**
```
{\\1c&H0000D7FF&\\t(200,200,\\1c&H00FFFFFF&)}Full
 ↑              ↑                           ↑
 Start GOLD     Change to WHITE at 200ms    Word text

No animation at 0ms → prevents white flash
```

**Subsequent words:**
```
{\\1c&H00FFFFFF&\\t(240,240,\\1c&H0000D7FF&)\\t(560,560,\\1c&H00FFFFFF&)}cap
 ↑              ↑                           ↑                           ↑
 Start WHITE    Change to GOLD at 240ms     Change to WHITE at 560ms    Word
```

### Complete Example

```typescript
// Segment: "Full cap it's" starting at 4.362s
const dialogueStartMs = 4362;

// Word 1: "Full" (4.362s - 4.562s)
const word1 = {
  start: 4362,  // Absolute
  end: 4562
};
const relativeStart1 = 4362 - 4362 = 0;    // Relative
const relativeEnd1 = 4562 - 4362 = 200;

// First word: Start gold
const anim1 = `{\\1c&H0000D7FF&\\t(200,200,\\1c&H00FFFFFF&)}Full`;

// Word 2: "cap" (4.602s - 4.922s)
const word2 = {
  start: 4602,
  end: 4922
};
const relativeStart2 = 4602 - 4362 = 240;
const relativeEnd2 = 4922 - 4362 = 560;

// Subsequent words: White → Gold → White
const anim2 = `{\\1c&H00FFFFFF&\\t(240,240,\\1c&H0000D7FF&)\\t(560,560,\\1c&H00FFFFFF&)}cap`;

// Final dialogue text
const text = `${anim1} ${anim2} ${anim3}`;
```

**Generated ASS:**
```
Dialogue: 0,0:00:04.36,0:00:05.28,Default,,0,0,0,,{\1c&H0000D7FF&\t(200,200,\1c&H00FFFFFF&)}Full {\1c&H00FFFFFF&\t(240,240,\1c&H0000D7FF&)\t(560,560,\1c&H00FFFFFF&)}cap {\1c&H00FFFFFF&\t(800,800,\1c&H0000D7FF&)\t(920,920,\1c&H00FFFFFF&)}it's
```

---

## Timing Calculations

### Relative vs Absolute Timing

**❌ WRONG (Absolute):**
```typescript
const highlightStartMs = Math.round(word.start * 1000);
// Result: \t(4602,4602,...) - doesn't work!
// ASS expects time relative to dialogue start, not video start
```

**✅ CORRECT (Relative):**
```typescript
const dialogueStartMs = segment.startTime * 1000;
const highlightStartMs = Math.round(word.start * 1000 - dialogueStartMs);
// Result: \t(240,240,...) - works!
```

### Time Format Conversion

**Seconds to ASS time:**
```typescript
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Example:
// 4.362 seconds → "0:00:04.36"
// 65.789 seconds → "0:01:05.78"
```

### Precision Requirements

- **Input timing**: Seconds (floating point)
- **ASS timing**: H:MM:SS.CC (centiseconds)
- **Animation tags**: Milliseconds (integers)

**Precision:** Centiseconds (10ms) is sufficient for smooth highlighting

---

## Font Installation

### Docker Alpine Requirements

Alpine Linux Docker images **do not include fonts by default**.

**Without fonts:**
- FFmpeg renders video successfully
- ASS subtitle file is processed
- **But captions are invisible** (no glyphs to render)

### Installation Process

**Dockerfile:**
```dockerfile
# Install fonts BEFORE copying FFmpeg libraries
# Order matters - apk breaks if run after binary copy
RUN apk add --no-cache \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    && fc-cache -f

# Now copy FFmpeg binaries
COPY --from=ffmpeg /bin/ffmpeg /bin/ffmpeg
COPY --from=ffmpeg /bin/ffprobe /bin/ffprobe
COPY --from=ffmpeg /lib /lib
```

### Font Selection

**Liberation Sans** (recommended):
- Metrically compatible with Arial
- Clean sans-serif for readability
- Includes bold variant
- Pre-installed in `ttf-liberation` package

**DejaVu Sans** (fallback):
- Unicode coverage
- Open source
- Slightly wider than Arial

**Testing fonts:**
```bash
# Inside container
fc-list | grep -i liberation
# Should show: Liberation Sans, Liberation Sans Bold, etc.
```

---

## Performance Optimizations

### Background Video Caching

**Problem:**
- Background videos are large (~50MB)
- Downloading from R2 takes 30-60 seconds
- Every video composition re-downloads same background

**Solution:**
```typescript
export async function getCachedBackgroundVideo(
  backgroundId: string,
  backgroundUrl: string
): Promise<string> {
  const cacheDir = '/tmp/cache/backgrounds';  // Writable in Railway
  const cachedPath = path.join(cacheDir, `${backgroundId}.mp4`);

  // Check cache
  if (existsSync(cachedPath)) {
    console.log(`[Cache HIT] Using cached background: ${backgroundId}`);
    return cachedPath;
  }

  // Cache miss - download
  console.log(`[Cache MISS] Downloading: ${backgroundId}`);
  await mkdir(cacheDir, { recursive: true });
  await downloadFile(backgroundUrl, cachedPath);

  return cachedPath;
}
```

**Performance Gains:**
- First request: ~60s (downloads background)
- Subsequent requests: ~45s (30% faster, uses cache)
- Cache persists for container lifetime
- Negligible disk usage (4 backgrounds × 50MB = 200MB)

### Cache Directory

**❌ Wrong:**
```typescript
const cacheDir = '/app/cache/backgrounds';  // Permission denied in Railway
```

**✅ Correct:**
```typescript
const cacheDir = '/tmp/cache/backgrounds';  // Writable
```

**Why `/tmp`?**
- Railway containers have read-only `/app` after build
- `/tmp` is always writable in containerized environments
- Files persist during container lifetime
- Cleared on container restart (acceptable)

---

## Code Deep Dive

### Complete ASS Generator Implementation

**File:** `src/utils/ass-generator.ts`

```typescript
export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface ASSGeneratorOptions {
  resolution: string; // e.g., '1080x1920'
  fontFamily?: string;
  fontSize?: number;
  primaryColor?: string; // Default: white (#FFFFFF)
  highlightColor?: string; // Default: gold (#FFD700)
  outlineColor?: string; // Default: black (#000000)
  marginBottom?: number; // Default: 300px from bottom
  wordsPerSegment?: number; // Default: 3
}

export function generateASS(
  timestamps: WordTimestamp[],
  options: ASSGeneratorOptions
): string {
  const [width, height] = options.resolution.split('x').map(Number);

  const fontFamily = options.fontFamily || 'DejaVu Sans';
  const fontSize = options.fontSize || 80;
  const primaryColor = colorToASS(options.primaryColor || '#FFFFFF');
  const highlightColor = colorToASS(options.highlightColor || '#FFD700');
  const outlineColor = colorToASS(options.outlineColor || '#000000');
  const marginBottom = options.marginBottom || 300;
  const wordsPerSegment = options.wordsPerSegment || 3;

  // 1. ASS file header
  let ass = `[Script Info]
Title: EasyBrainrot Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,10,10,${marginBottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // 2. Segment words into phrases
  const segments = segmentWords(timestamps, wordsPerSegment);

  // 3. Generate dialogue for each segment
  segments.forEach((segment) => {
    const startTime = formatASSTime(segment.startTime);
    const endTime = formatASSTime(segment.endTime);
    const dialogueStartMs = segment.startTime * 1000;

    // Build text with inline color animations
    const textWithAnimations = segment.words
      .map((wordInfo, wordIndex) => {
        // Calculate timing RELATIVE to dialogue start
        const highlightStartMs = Math.round(wordInfo.start * 1000 - dialogueStartMs);
        const highlightEndMs = Math.round(wordInfo.end * 1000 - dialogueStartMs);

        // First word: Start gold (no 0ms animation)
        // Other words: White → Gold → White
        const animationTag = wordIndex === 0
          ? `{\\1c${highlightColor}&\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`
          : `{\\1c${primaryColor}&\\t(${highlightStartMs},${highlightStartMs},\\1c${highlightColor}&)\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`;

        return `${animationTag}${wordInfo.word}`;
      })
      .join(' ');

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${textWithAnimations}\n`;
  });

  return ass;
}

function segmentWords(
  timestamps: WordTimestamp[],
  maxWordsPerSegment: number
): {
  startTime: number;
  endTime: number;
  words: { word: string; start: number; end: number }[];
}[] {
  const segments = [];
  let currentSegment = [];
  let segmentStartTime = 0;

  timestamps.forEach((timestamp, index) => {
    if (currentSegment.length === 0) {
      segmentStartTime = timestamp.start;
    }

    currentSegment.push({
      word: timestamp.word,
      start: timestamp.start,
      end: timestamp.end
    });

    const isLastWord = index === timestamps.length - 1;
    const segmentFull = currentSegment.length >= maxWordsPerSegment;
    const nextWordHasGap = !isLastWord &&
      timestamps[index + 1].start - timestamp.end > 0.3; // 300ms gap

    if (isLastWord || segmentFull || nextWordHasGap) {
      const lastWord = currentSegment[currentSegment.length - 1];
      segments.push({
        startTime: segmentStartTime,
        endTime: lastWord.end,
        words: [...currentSegment]
      });
      currentSegment = [];
    }
  });

  return segments;
}

function colorToASS(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
```

---

## Testing & Verification

### Test Caption Generation

```typescript
import { generateASS } from './src/utils/ass-generator';

const testData = [
  { word: "Full", start: 4.362, end: 4.562 },
  { word: "cap", start: 4.602, end: 4.922 },
  { word: "it's", start: 5.162, end: 5.282 }
];

const ass = generateASS(testData, {
  resolution: '1080x1920',
  fontFamily: 'Liberation Sans',
  fontSize: 80,
  primaryColor: '#FFFFFF',
  highlightColor: '#FFD700'
});

console.log(ass);
```

### Verify FFmpeg Rendering

```bash
ffmpeg -i background.mp4 -i audio.mp3 \
  -filter_complex "[0:v]ass='captions.ass'[final]" \
  -map "[final]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 192k \
  output.mp4
```

### Visual Inspection Checklist

- [ ] Captions appear at bottom of screen
- [ ] Words highlight in gold as spoken
- [ ] No overlapping phrases
- [ ] First word of phrase starts gold (no flash)
- [ ] Smooth color transitions
- [ ] Proper phrase segmentation (2-3 words)
- [ ] No gaps between phrases

---

## References

**ASS Specification:**
- [ASS Subtitle Format](http://www.tcax.org/docs/ass-specs.htm)
- [Aegisub ASS Tags](https://aegisub.org/docs/latest/ass_tags/)
- [Stack Overflow: Animating ASS Words](https://stackoverflow.com/questions/76848089/)

**FFmpeg Documentation:**
- [FFmpeg ASS Filter](https://ffmpeg.org/ffmpeg-filters.html#ass)
- [Subtitle Formats](https://trac.ffmpeg.org/wiki/HowToBurnSubtitlesIntoVideo)

**Font Resources:**
- [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts)
- [DejaVu Fonts](https://dejavu-fonts.github.io/)

---

**Status:** ✅ Production Ready
**Last Updated:** November 23, 2025
**Processing:** 80-second videos in ~45 seconds (with caching)
