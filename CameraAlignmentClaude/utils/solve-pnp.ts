/**
 * Approximates cv2.solvePnP for a planar ArUco marker using similar-triangle geometry.
 * Returns tvec components equivalent to what Python's solvePnP gives:
 *   tvec[0] = x (horizontal offset, cm)
 *   tvec[1] = y (vertical offset in camera view, cm)
 *   tvec[2] = z (depth, cm)
 */
export interface PoseResult {
  tvec: [number, number, number];
  dist: number; // Euclidean distance in cm
}

export function estimatePose(
  corners: [[number, number], [number, number], [number, number], [number, number]],
  focalLength: number,
  cx: number,
  cy: number,
  markerWidthCm: number
): PoseResult | null {
  // Average top and bottom edge widths for a robust pixel-width estimate
  const topWidth = Math.hypot(
    corners[1][0] - corners[0][0],
    corners[1][1] - corners[0][1]
  );
  const bottomWidth = Math.hypot(
    corners[2][0] - corners[3][0],
    corners[2][1] - corners[3][1]
  );
  const pixelWidth = (topWidth + bottomWidth) / 2;

  if (pixelWidth < 10) return null;

  // Depth via similar triangles: Z = (f * W_real) / W_pixels
  const z = (focalLength * markerWidthCm) / pixelWidth;

  // Marker center in image pixels
  const centerX = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
  const centerY = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;

  // Back-project to camera-frame metric coordinates
  const x = ((centerX - cx) * z) / focalLength;
  const y = ((centerY - cy) * z) / focalLength;

  const dist = Math.sqrt(x * x + y * y + z * z);

  return { tvec: [x, y, z], dist };
}
