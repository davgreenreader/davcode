import cv2
import numpy as np
import math

# --- 1. CALIBRATION & HARDWARE DIMENSIONS ---
CALIBRATION_PIXEL_WIDTH = 185.0  
KNOWN_DISTANCE_CM = 60.96  #24in calibration distance
KNOWN_WIDTH_CM = 10.0      

# THE NEW MISSING DIMENSIONS (You must measure these in cm!)
CAMERA_HEIGHT_CM = 20.0  # Estimate: Height of camera lens off the ground
TAG_HEIGHT_CM = 20.0     # Estimate: Height of tag center off the ground

FOCAL_LENGTH = (CALIBRATION_PIXEL_WIDTH * KNOWN_DISTANCE_CM) / KNOWN_WIDTH_CM

marker_half = KNOWN_WIDTH_CM / 2.0
obj_points = np.array([
    [-marker_half,  marker_half, 0], 
    [ marker_half,  marker_half, 0], 
    [ marker_half, -marker_half, 0], 
    [-marker_half, -marker_half, 0]  
], dtype=np.float32)

dist_coeffs = np.zeros((4, 1))

# --- 2. DUMMY IMU SENSOR FUNCTION ---
def get_imu_pitch():
    # Placeholder: Returns 0.0 degrees. 
    # Positive = Putter tilted UP. Negative = Putter tilted DOWN.
    # We will replace this with real serial data from your IMU!
    return 0.0 

# --- 3. GLOBAL UI HELPERS ---
quit_app = False 
btn_x1, btn_y1, btn_x2, btn_y2 = 0, 10, 0, 50

def handle_mouse_click(event, x, y, flags, param):
    global quit_app
    if event == cv2.EVENT_LBUTTONDOWN:
        if btn_x1 <= x <= btn_x2 and btn_y1 <= y <= btn_y2:
            quit_app = True

# --- 4. INITIALIZE CAMERA & ARUCO ---
cap = cv2.VideoCapture(0)
cv2.namedWindow("Absolute Elevation System")
cv2.setMouseCallback("Absolute Elevation System", handle_mouse_click)

ret, temp_frame = cap.read()
if ret:
    frame_h, frame_w = temp_frame.shape[:2]
    btn_x1, btn_x2 = frame_w - 120, frame_w - 10
    cx, cy = frame_w // 2, frame_h // 2

    camera_matrix = np.array([
        [FOCAL_LENGTH, 0, cx],
        [0, FOCAL_LENGTH, cy],
        [0, 0, 1]
    ], dtype=np.float32)

aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_6X6_250)
aruco_params = cv2.aruco.DetectorParameters()
detector = cv2.aruco.ArucoDetector(aruco_dict, aruco_params)

print("System active.")

while not quit_app:
    ret, frame = cap.read()
    if not ret: break
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # UI: Draw Close Button
    cv2.rectangle(frame, (btn_x1, btn_y1), (btn_x2, btn_y2), (0, 0, 255), -1)
    cv2.putText(frame, "CLOSE", (btn_x1 + 15, btn_y1 + 27), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    corners, ids, _ = detector.detectMarkers(gray)

    if ids is not None and 121 in ids.flatten():
        target_idx = np.where(ids.flatten() == 121)[0][0]
        success, rvec, tvec = cv2.solvePnP(obj_points, corners[target_idx][0], camera_matrix, dist_coeffs)

        if success:
            # 1. Get raw camera translation data
            cam_y_offset = tvec[1][0]  # Vertical offset in camera's local view
            cam_z_depth = tvec[2][0]   # Depth distance in camera's local view
            
            # 2. Get the current physical tilt of the putter (Currently 0.0)
            pitch_degrees = get_imu_pitch()
            pitch_radians = math.radians(pitch_degrees)

            # 3. SENSOR FUSION: Rotate the camera's Y-vector by the IMU's pitch angle
            # This calculates the true height of the tag relative to the camera lens
            true_tag_y_relative_to_lens = (cam_z_depth * math.sin(pitch_radians)) + (cam_y_offset * math.cos(pitch_radians))

            # 4. Calculate Absolute Ground Elevation
            # We add our physical hardware dimensions to find the actual ground slope
            absolute_elevation_cm = true_tag_y_relative_to_lens + CAMERA_HEIGHT_CM - TAG_HEIGHT_CM

            # Format for display
            dist_in = np.linalg.norm(tvec) / 2.54
            color = (0, 255, 0) if abs(absolute_elevation_cm) < 2.0 else (0, 255, 255)

            # Draw Visuals
            cv2.polylines(frame, [corners[target_idx][0].astype(np.int32)], True, color, 2)
            cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, 5.0)

            # Display Data
            cv2.putText(frame, f"Dist: {dist_in:.1f} in", (20, frame_h - 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, f"Cam Pitch: {pitch_degrees:.1f} deg", (20, frame_h - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 200, 0), 2)
            cv2.putText(frame, f"Ground Elev: {absolute_elevation_cm:+.1f} cm", (20, frame_h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    cv2.imshow("Absolute Elevation System", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break
    if cv2.getWindowProperty("Absolute Elevation System", cv2.WND_PROP_VISIBLE) < 1: break

cap.release()
cv2.destroyAllWindows()