// AruCo marker ID to track
export const ARUCO_MARKER_ID = 121;

// Physical width of the marker in centimetres (adjust to match the printed tag)
export const KNOWN_WIDTH_CM = 10.0;

// Calibration: pixel width of marker at a known distance
// Measured at 60.96 cm (24 in) with a 10 cm marker → ~185 px at 640 px frame width
export const CALIBRATION_PIXEL_WIDTH = 185.0;
export const KNOWN_DISTANCE_CM = 60.96;

// Base focal length (calibrated at 640 px frame width)
// Scaled at runtime: FOCAL_LENGTH_BASE * (frameWidth / 640)
export const FOCAL_LENGTH_BASE =
  (CALIBRATION_PIXEL_WIDTH * KNOWN_DISTANCE_CM) / KNOWN_WIDTH_CM;
