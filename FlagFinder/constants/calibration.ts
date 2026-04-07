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

// Empirical distance correction — linear fit from field test data:
//   Expected  5 ft → measured  5.0 ft  (0%   error)
//   Expected 10 ft → measured 11.0 ft  (+10% error)
//   Expected 15 ft → measured 16.3 ft  (+9%  error)
//   Expected 20 ft → measured 23.1 ft  (+15% error)
//
// Least-squares fit:  actual = DIST_CORR_SCALE × raw + DIST_CORR_OFFSET
// Extrapolates cleanly to ~50 ft.
//
// TIP: keep the camera lens at the same height as the tag for best results.
// A significant height difference means the camera measures line-of-sight
// distance (longer) rather than the ground distance you care about.
export const DIST_CORR_SCALE  = 0.837;  // dimensionless scale on raw reading
export const DIST_CORR_OFFSET = 0.908;  // additive offset in feet
