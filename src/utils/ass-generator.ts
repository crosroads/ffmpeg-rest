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
  fontFamily?: string; // Default: 'Arial Black'
  fontSize?: number; // Default: 80
  primaryColor?: string; // Default: white (#FFFFFF)
  highlightColor?: string; // Default: gold (#FFD700)
  outlineColor?: string; // Default: black (#000000)
  marginBottom?: number; // Default: 80px from bottom
}

/**
 * Generate ASS subtitle file content from word timestamps
 */
export function generateASS(timestamps: WordTimestamp[], options: ASSGeneratorOptions): string {
  const [width, height] = options.resolution.split('x').map(Number);

  const fontFamily = options.fontFamily || 'Arial Black';
  const fontSize = options.fontSize || 80;
  const primaryColor = colorToASS(options.primaryColor || '#FFFFFF');
  const highlightColor = colorToASS(options.highlightColor || '#FFD700');
  const outlineColor = colorToASS(options.outlineColor || '#000000');
  const marginBottom = options.marginBottom || 80;

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

  // Add dialogue lines with word-by-word highlighting
  // Show 3-word context window (previous word, current highlighted word, next word)
  timestamps.forEach(({ word, start, end }, index) => {
    const startTime = formatASSTime(start);
    const endTime = formatASSTime(end);

    // Build the text with context
    const words: string[] = [];

    // Add previous word (if exists) - shown in primary color
    if (index > 0) {
      words.push(timestamps[index - 1].word);
    }

    // Add current word - shown in highlight color
    words.push(`{\\c${highlightColor}}${word}{\\c${primaryColor}}`);

    // Add next word (if exists) - shown in primary color
    if (index < timestamps.length - 1) {
      words.push(timestamps[index + 1].word);
    }

    const text = words.join(' ');

    // Create dialogue line without karaoke effect
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  });

  return ass;
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
