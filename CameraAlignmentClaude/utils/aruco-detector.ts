/**
 * Wraps js-aruco for ArUco marker detection.
 * Input: raw RGB pixel array from vision-camera-resize-plugin.
 * Output: detected markers with id and corner positions.
 */
import AR from 'js-aruco';

export interface MarkerCorner {
  x: number;
  y: number;
}

export interface DetectedMarker {
  id: number;
  corners: [MarkerCorner, MarkerCorner, MarkerCorner, MarkerCorner];
}

// Single shared detector instance (matches Python's one-time initialization)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const detector = new (AR as any).AR.Detector();

/**
 * Converts an RGB Uint8Array to an RGBA Uint8ClampedArray
 * (js-aruco expects ImageData-style RGBA input).
 */
function rgbToRgba(rgb: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const total = width * height;
  for (let i = 0; i < total; i++) {
    rgba[i * 4]     = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

export function detectArucoMarkers(
  rgbData: Uint8Array,
  width: number,
  height: number
): DetectedMarker[] {
  try {
    const rgba = rgbToRgba(rgbData, width, height);
    const imageData = { data: rgba, width, height };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = detector.detect(imageData);
    return raw.map((m) => ({
      id: m.id as number,
      corners: m.corners as [MarkerCorner, MarkerCorner, MarkerCorner, MarkerCorner],
    }));
  } catch {
    return [];
  }
}
