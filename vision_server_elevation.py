import cv2
import cv2.aruco as aruco
import numpy as np
import threading
import asyncio
import websockets
import json

# Global dictionary updated to hold the new elevation data
latest_alignment = {"distance_m": 0.0, "offset_m": 0.0, "elevation_px": 0, "aligned": False}

async def broadcast_data(websocket):
    print("Flutter App Connected!")
    try:
        while True:
            # Send the JSON payload
            await websocket.send(json.dumps(latest_alignment))
            await asyncio.sleep(0.1) # 10 Hz update rate
    except websockets.exceptions.ConnectionClosed:
        print("Flutter App Disconnected.")

async def start_server():
    print("WebSocket Server running on port 8765...")
    async with websockets.serve(broadcast_data, "0.0.0.0", 8765):
        await asyncio.Future()  # Keeps the server running forever

def run_websocket_server():
    asyncio.run(start_server())

def vision_loop():
    global latest_alignment
    cap = cv2.VideoCapture(0) # Remember to use your working index!

    aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_6X6_250)
    parameters = aruco.DetectorParameters()
    marker_length = 0.1 

    obj_points = np.array([
        [-marker_length/2,  marker_length/2, 0],
        [ marker_length/2,  marker_length/2, 0],
        [ marker_length/2, -marker_length/2, 0],
        [-marker_length/2, -marker_length/2, 0]
    ], dtype=np.float32)

    # iPhone cam dimensions
    camera_matrix = np.array([[2547.0, 0, 640.0], [0, 2547.0, 360.0], [0, 0, 1]], dtype=np.float32)
    dist_coeffs = np.zeros((4,1)) 

    print("Camera active. Looking for markers...")

    while True:
        ret, frame = cap.read()
        if not ret: break
        
        # Calculate screen center for elevation math
        frame_height, frame_width = frame.shape[:2]
        screen_center_y = frame_height // 2

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = aruco.detectMarkers(gray, aruco_dict, parameters=parameters)

        # Draw the horizontal center line
        cv2.line(frame, (0, screen_center_y), (frame_width, screen_center_y), (255, 255, 255), 1)

        if ids is not None:
            aruco.drawDetectedMarkers(frame, corners, ids)
            
            # Extract corners to calculate the object's center pixel
            tag_corners = corners[0][0]
            topLeft, topRight, bottomRight, bottomLeft = tag_corners
            
            obj_center_x = int((topLeft[0] + bottomRight[0]) / 2)
            obj_center_y = int((topLeft[1] + bottomRight[1]) / 2)
            
            # CALCULATE ELEVATION (Positive = above center line, Negative = below)
            pixel_elevation = screen_center_y - obj_center_y
            
            success, rvec, tvec = cv2.solvePnP(obj_points, tag_corners, camera_matrix, dist_coeffs)
            
            if success:
                # Draw the 3D axes (X=Red, Y=Green, Z=Blue)
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, 0.03)
                
                # Visuals for elevation
                cv2.circle(frame, (obj_center_x, obj_center_y), 5, (0, 0, 255), -1) # Red center dot
                cv2.line(frame, (obj_center_x, screen_center_y), (obj_center_x, obj_center_y), (0, 255, 255), 1) # Yellow connecting line
                cv2.putText(frame, f"Elev: {pixel_elevation} px", (int(topLeft[0]), int(topLeft[1]) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                x_offset = float(tvec[0][0])
                distance = float(tvec[2][0])
                
                # Update our global dictionary with the live data including elevation
                latest_alignment["distance_m"] = round(distance, 2)
                latest_alignment["offset_m"] = round(x_offset, 2)
                latest_alignment["elevation_px"] = pixel_elevation
                latest_alignment["aligned"] = abs(x_offset) < 0.10 

                # Print the live data to the terminal
                print(f"Dist: {latest_alignment['distance_m']}m | Offset: {latest_alignment['offset_m']}m | Elev: {latest_alignment['elevation_px']}px | Aligned: {latest_alignment['aligned']}")

        cv2.imshow("Golf Tracking Prototyping Feed", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    # 1. Start the WebSocket server in a background thread
    server_thread = threading.Thread(target=run_websocket_server, daemon=True)
    server_thread.start()

    # 2. Run the OpenCV camera feed on the MAIN thread
    vision_loop()