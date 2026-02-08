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
  const positions: Record<OverlayPosition, string> = {
    'top-left': `${marginX}:${marginY}`,
    'top-right': `W-w-${marginX}:${marginY}`,
    'bottom-left': `${marginX}:H-h-${marginY}`,
    'bottom-right': `W-w-${marginX}:H-h-${marginY}`
  };

  return positions[position];
}
