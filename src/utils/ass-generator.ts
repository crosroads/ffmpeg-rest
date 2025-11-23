/**
 * ASS (Advanced SubStation Alpha) Subtitle Generator
 * Generates karaoke-style captions with word-level highlighting
 */

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface ASSGeneratorOptions {
  resolution: string; // e.g., '1080x1920'
  fontFamily?: string; // Default: 'DejaVu Sans'
  fontSize?: number; // Default: 80
  primaryColor?: string; // Default: white (#FFFFFF)
  highlightColor?: string; // Default: gold (#FFD700)
  outlineColor?: string; // Default: black (#000000)
  marginBottom?: number; // Default: 300px from bottom
  wordsPerSegment?: number; // Default: 3 (2-3 word phrases)
}

/**
 * Generate ASS subtitle file content from word timestamps
 * Uses phrase segmentation with inline color animation (not separate dialogue per word)
 */
export function generateASS(timestamps: WordTimestamp[], options: ASSGeneratorOptions): string {
  const [width, height] = options.resolution.split('x').map(Number);

  const fontFamily = options.fontFamily || 'DejaVu Sans';
  const fontSize = options.fontSize || 80;
  const primaryColor = colorToASS(options.primaryColor || '#FFFFFF');
  const highlightColor = colorToASS(options.highlightColor || '#FFD700');
  const outlineColor = colorToASS(options.outlineColor || '#000000');
  const marginBottom = options.marginBottom || 300;
  const wordsPerSegment = options.wordsPerSegment || 3;

  // ASS file header
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

  // Segment words into phrases (2-3 words per dialogue)
  const segments = segmentWords(timestamps, wordsPerSegment);

  // Generate dialogue for each segment with inline color animations
  segments.forEach((segment) => {
    const startTime = formatASSTime(segment.startTime);
    const endTime = formatASSTime(segment.endTime);

    // Build text with inline color animations for each word
    const textWithAnimations = segment.words
      .map((wordInfo) => {
        // Convert seconds to milliseconds for \t animation tags
        const highlightStartMs = Math.round(wordInfo.start * 1000);
        const highlightEndMs = Math.round(wordInfo.end * 1000);

        // Animation pattern: white -> gold (at word start) -> white (at word end)
        const animationTag = `{\\1c${primaryColor}&\\t(${highlightStartMs},${highlightStartMs},\\1c${highlightColor}&)\\t(${highlightEndMs},${highlightEndMs},\\1c${primaryColor}&)}`;

        return `${animationTag}${wordInfo.word}`;
      })
      .join(' ');

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${textWithAnimations}\n`;
  });

  return ass;
}

/**
 * Segment words into phrases based on timing and max words per segment
 */
function segmentWords(
  timestamps: WordTimestamp[],
  maxWordsPerSegment: number
): {
  startTime: number;
  endTime: number;
  words: { word: string; start: number; end: number }[];
}[] {
  const segments: {
    startTime: number;
    endTime: number;
    words: { word: string; start: number; end: number }[];
  }[] = [];

  let currentSegment: { word: string; start: number; end: number }[] = [];
  let segmentStartTime = 0;

  timestamps.forEach((timestamp, index) => {
    // Start new segment
    if (currentSegment.length === 0) {
      segmentStartTime = timestamp.start;
    }

    currentSegment.push({
      word: timestamp.word,
      start: timestamp.start,
      end: timestamp.end
    });

    // Determine if we should close this segment
    const isLastWord = index === timestamps.length - 1;
    const segmentFull = currentSegment.length >= maxWordsPerSegment;
    const nextWordHasGap = !isLastWord && timestamps[index + 1].start - timestamp.end > 0.3; // 300ms gap = natural phrase break

    if (isLastWord || segmentFull || nextWordHasGap) {
      // Close current segment
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

/**
 * Convert hex color to ASS format
 * ASS uses &HAABBGGRR format (alpha, blue, green, red)
 */
function colorToASS(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // ASS format: &H00BBGGRR (00 = fully opaque)
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Format timestamp for ASS subtitle format
 * Format: H:MM:SS.CC (hours:minutes:seconds.centiseconds)
 */
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
