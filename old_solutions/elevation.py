import cv2
import numpy as np

# --- 1. YOUR CALIBRATION DATA ---
# Replace '185.0' with the exact pixel width you found at 24 inches
CALIBRATION_PIXEL_WIDTH = 185.0 
KNOWN_DISTANCE_CM = 60.96  
KNOWN_WIDTH_CM = 10.0      

FOCAL_LENGTH = (CALIBRATION_PIXEL_WIDTH * KNOWN_DISTANCE_CM) / KNOWN_WIDTH_CM

# Define the true 3D corners of a 10cm tag (assuming the center of the tag is 0,0,0)
marker_half = KNOWN_WIDTH_CM / 2.0
obj_points = np.array([
    [-marker_half,  marker_half, 0], # Top Left
    [ marker_half,  marker_half, 0], # Top Right
    [ marker_half, -marker_half, 0], # Bottom Right
    [-marker_half, -marker_half, 0]  # Bottom Left
], dtype=np.float32)

# Assume zero lens distortion for this PoC
dist_coeffs = np.zeros((4, 1))

# --- 2. GLOBAL QUIT FLAG & MOUSE LISTENER ---
quit_app = False 
btn_x1, btn_y1 = 0, 10
btn_x2, btn_y2 = 0, 50

def handle_mouse_click(event, x, y, flags, param):
    global quit_app
    if event == cv2.EVENT_LBUTTONDOWN:
        if btn_x1 <= x <= btn_x2 and btn_y1 <= y <= btn_y2:
            print("On-screen CLOSE button clicked!")
            quit_app = True

# --- 3. INITIALIZE CAMERA & APRILTAG DETECTOR ---
cap = cv2.VideoCapture(0)

cv2.namedWindow("Putter Tracking")
cv2.setMouseCallback("Putter Tracking", handle_mouse_click)

ret, temp_frame = cap.read()
if ret:
    frame_height, frame_width = temp_frame.shape[:2]
    btn_x1 = frame_width - 120 
    btn_x2 = frame_width - 10  
    screen_center_x = frame_width // 2
    screen_center_y = frame_height // 2

    # Build the Approximated Camera Matrix
    camera_matrix = np.array([
        [FOCAL_LENGTH, 0, screen_center_x],
        [0, FOCAL_LENGTH, screen_center_y],
        [0, 0, 1]
    ], dtype=np.float32)

# Setup ArUco for DICT_6X6_250 (Includes your ID 121)
aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_6X6_250)
aruco_params = cv2.aruco.DetectorParameters()
detector = cv2.aruco.ArucoDetector(aruco_dict, aruco_params)

print("Starting 3D tracking. Looking for 6x6 ArUco Tag ID: 121.")

while not quit_app:
    ret, frame = cap.read()
    if not ret:
        break

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # --- 4. DRAW UI ---
    cv2.rectangle(frame, (btn_x1, btn_y1), (btn_x2, btn_y2), (0, 0, 255), -1)
    cv2.rectangle(frame, (btn_x1, btn_y1), (btn_x2, btn_y2), (255, 255, 255), 2)
    cv2.putText(frame, "CLOSE", (btn_x1 + 15, btn_y1 + 27), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.line(frame, (0, screen_center_y), (frame_width, screen_center_y), (255, 255, 255), 1)

    # --- 5. DETECT TAG & CALCULATE 3D POSE ---
    corners, ids, rejected = detector.detectMarkers(gray_frame)

    if ids is not None:
        ids = ids.flatten()
        if 121 in ids:
            target_idx = np.where(ids == 121)[0][0]
            tag_corners = corners[target_idx][0]
            
            # Run Pose Estimation magic
            # Outputs rvec (rotation) and tvec (translation/3D position)
            success, rvec, tvec = cv2.solvePnP(obj_points, tag_corners, camera_matrix, dist_coeffs)

            if success:
                # The true 3D distance is the magnitude of the translation vector
                distance_cm = np.linalg.norm(tvec)
                distance_in = distance_cm / 2.54

                # Calculate Pixel Elevation (for the perspective visual)
                topLeft, topRight, bottomRight, bottomLeft = tag_corners
                obj_center_x = int((topLeft[0] + bottomRight[0]) / 2)
                obj_center_y = int((topLeft[1] + bottomRight[1]) / 2)
                pixel_elevation = screen_center_y - obj_center_y

                # --- 6. DRAW VISUALS ---
                cv2.polylines(frame, [tag_corners.astype(np.int32)], True, (0, 255, 0), 2)
                cv2.circle(frame, (obj_center_x, obj_center_y), 5, (0, 0, 255), -1)
                cv2.line(frame, (obj_center_x, screen_center_y), (obj_center_x, obj_center_y), (0, 255, 255), 1)

                # Draw the 3D axes protruding from the tag to verify rotation
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, 5.0)

                # Display highly accurate distance
                cv2.putText(frame, f"3D Dist: {distance_in:.1f} in", (int(topLeft[0]), int(topLeft[1]) - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(frame, f"Elev: {pixel_elevation} px", (int(topLeft[0]), int(topLeft[1]) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    cv2.imshow("Putter Tracking", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
    if cv2.getWindowProperty("Putter Tracking", cv2.WND_PROP_VISIBLE) < 1:
        break

cap.release()
cv2.destroyAllWindows()
for i in range(10): cv2.waitKey(1)
print("Camera successfully closed.")