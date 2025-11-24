/**
 * Watermark overlay position presets for FFmpeg
 * Returns FFmpeg overlay filter position string
 */

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Get FFmpeg overlay position string for watermark
 *
 * @param position - Predefined position name
 * @param padding - Padding from edges in pixels (default: 400 for platform UI clearance)
 * @returns FFmpeg overlay position string (x:y coordinates)
 *
 * Note: Default 400px padding ensures watermark clears TikTok UI (320px), Instagram Reels (420px)
 */
export function getWatermarkPosition(position: WatermarkPosition = 'bottom-center', padding = 400): string {
  const positions: Record<WatermarkPosition, string> = {
    'top-left': `${padding}:${padding}`,
    'top-center': `(main_w-overlay_w)/2:${padding}`,
    'top-right': `main_w-overlay_w-${padding}:${padding}`,

    'middle-left': `${padding}:(main_h-overlay_h)/2`,
    'middle-center': `(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
    'middle-right': `main_w-overlay_w-${padding}:(main_h-overlay_h)/2`,

    'bottom-left': `${padding}:main_h-overlay_h-${padding}`,
    'bottom-center': `(main_w-overlay_w)/2:main_h-overlay_h-${padding}`,
    'bottom-right': `main_w-overlay_w-${padding}:main_h-overlay_h-${padding}`
  };

  return positions[position];
}
