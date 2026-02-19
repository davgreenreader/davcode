import cv2
import cv2.aruco as aruco
import numpy as np

# Use your working index (0 or 1)
cap = cv2.VideoCapture(1)

# 1. Define Marker and Camera parameters
aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_6X6_250)
parameters = aruco.DetectorParameters()

# Define the physical size of the marker you are testing with in METERS. 
# If your phone screen marker is roughly 5cm wide, use 0.05
marker_length = 0.05 

# Create the 3D coordinates of the marker's corners in the real world
obj_points = np.array([
    [-marker_length/2,  marker_length/2, 0],
    [ marker_length/2,  marker_length/2, 0],
    [ marker_length/2, -marker_length/2, 0],
    [-marker_length/2, -marker_length/2, 0]
], dtype=np.float32)

# Dummy camera matrix for a generic 720p/1080p webcam prototype
focal_length = 1000.0
center_x = 640.0
center_y = 360.0
camera_matrix = np.array([
    [focal_length, 0, center_x],
    [0, focal_length, center_y],
    [0, 0, 1]
], dtype=np.float32)
dist_coeffs = np.zeros((4,1)) # Assuming no lens distortion for the dummy prototype

print("Streaming... Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    corners, ids, rejected = aruco.detectMarkers(gray, aruco_dict, parameters=parameters)

    if ids is not None:
        aruco.drawDetectedMarkers(frame, corners, ids)
        
        # Calculate 3D position for each detected marker
        for i in range(len(ids)):
            # solvePnP calculates the 3D pose of the marker
            success, rvec, tvec = cv2.solvePnP(obj_points, corners[i][0], camera_matrix, dist_coeffs)
            
            if success:
                # Draw the 3D axes (X=Red, Y=Green, Z=Blue) pointing out of the marker
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, 0.03)
                
                # Extract the translation data (in meters)
                # tvec[0] is Left/Right (X axis)
                # tvec[1] is Up/Down (Y axis)
                # tvec[2] is Distance away from camera (Z axis)
                
                x_offset = tvec[0][0] 
                distance = tvec[2][0]
                
                print(f"Distance: {distance:.2f}m | Horizontal Offset: {x_offset:.2f}m")

    cv2.imshow("Golf Tracking Prototyping Feed", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()