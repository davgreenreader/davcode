// Processing resolution
export const PROCESS_WIDTH = 320;
export const PROCESS_HEIGHT = 240;

export const CALIBRATION_PIXEL_WIDTH = 185.0;
export const KNOWN_DISTANCE_CM = 60.96; // 24 inches
export const KNOWN_WIDTH_CM = 10.0;
// Base focal length at 640px calibration width
export const FOCAL_LENGTH_BASE =
  (CALIBRATION_PIXEL_WIDTH * KNOWN_DISTANCE_CM) / KNOWN_WIDTH_CM;
// Legacy scaled value kept for reference; use FOCAL_LENGTH_BASE * (frameW / 640) at runtime
export const FOCAL_LENGTH =
  FOCAL_LENGTH_BASE * (PROCESS_WIDTH / 640.0);

export const ARUCO_MARKER_ID = 121;
