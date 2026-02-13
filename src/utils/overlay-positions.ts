/**
 * Overlay position presets for FFmpeg's overlay filter.
 * Returns FFmpeg overlay position expression for 4 corner positions.
 *
 * Uses FFmpeg overlay variables:
 *   W = main (background) video width
 *   H = main (background) video height
 *   w = overlay image width
 *   h = overlay image height
 */

export type OverlayPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export function getOverlayPosition(position: OverlayPosition = 'top-right', marginX = 20, marginY = 20): string {
  // Values < 1 are treated as fractions (e.g., 0.03 = 3% of W/H)
  // Values >= 1 are treated as pixels (backward compatible)
  const mx = marginX < 1 ? `W*${marginX}` : `${marginX}`;
  const my = marginY < 1 ? `H*${marginY}` : `${marginY}`;

  const positions: Record<OverlayPosition, string> = {
    'top-left': `${mx}:${my}`,
    'top-right': `W-w-${mx}:${my}`,
    'bottom-left': `${mx}:H-h-${my}`,
    'bottom-right': `W-w-${mx}:H-h-${my}`
  };

  return positions[position];
}
