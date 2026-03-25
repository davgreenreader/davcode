// Mirrors calibration constants from elevation_V2.py

export const CALIBRATION_PIXEL_WIDTH = 185.0;
export const KNOWN_DISTANCE_CM = 60.96; // 24 inches
export const KNOWN_WIDTH_CM = 10.0;
export const FOCAL_LENGTH = (CALIBRATION_PIXEL_WIDTH * KNOWN_DISTANCE_CM) / KNOWN_WIDTH_CM;

// Physical hardware dimensions (measure and update these)
export const CAMERA_HEIGHT_CM = 20.0; // Height of camera lens off the ground
export const TAG_HEIGHT_CM = 20.0;    // Height of ArUco tag center off the ground

export const ARUCO_MARKER_ID = 121;   // Target marker ID (DICT_6X6_250)
