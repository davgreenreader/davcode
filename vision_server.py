import cv2
import cv2.aruco as aruco
import numpy as np
import threading
import asyncio
import websockets
import json

# Global dictionary to hold the latest alignment data
latest_alignment = {"distance_m": 0.0, "offset_m": 0.0, "aligned": False}

async def broadcast_data(websocket):
    print("Flutter App Connected!")
    try:
        while True:
            # Send the JSON payload
            await websocket.send(json.dumps(latest_alignment))
            await asyncio.sleep(0.1) # 10 Hz update rate
    except websockets.exceptions.ConnectionClosed:
        print("Flutter App Disconnected.")

# NEW: An async function to properly create and hold the server open
async def start_server():
    print("WebSocket Server running on port 8765...")
    # websockets.serve is now an async context manager
    async with websockets.serve(broadcast_data, "0.0.0.0", 8765):
        await asyncio.Future()  # Keeps the server running forever

# UPDATED: We use asyncio.run() to generate the required event loop
def run_websocket_server():
    asyncio.run(start_server())

def vision_loop():
    global latest_alignment
    cap = cv2.VideoCapture(1) # Remember to use your working index!

    aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_6X6_250)
    parameters = aruco.DetectorParameters()
    marker_length = 0.1 

    obj_points = np.array([
        [-marker_length/2,  marker_length/2, 0],
        [ marker_length/2,  marker_length/2, 0],
        [ marker_length/2, -marker_length/2, 0],
        [-marker_length/2, -marker_length/2, 0]
    ], dtype=np.float32)

    camera_matrix = np.array([[1000.0, 0, 640.0], [0, 1000.0, 360.0], [0, 0, 1]], dtype=np.float32)
    dist_coeffs = np.zeros((4,1)) 

    print("Camera active. Looking for markers...")

    while True:
        ret, frame = cap.read()
        if not ret: break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = aruco.detectMarkers(gray, aruco_dict, parameters=parameters)

        if ids is not None:
            aruco.drawDetectedMarkers(frame, corners, ids)
            success, rvec, tvec = cv2.solvePnP(obj_points, corners[0][0], camera_matrix, dist_coeffs)
            
            if success:
                # 1. ADD THIS BACK: Draw the 3D axes (X=Red, Y=Green, Z=Blue)
                cv2.drawFrameAxes(frame, camera_matrix, dist_coeffs, rvec, tvec, 0.03)
                
                x_offset = float(tvec[0][0])
                distance = float(tvec[2][0])
                
                # Update our global dictionary with the live data
                latest_alignment["distance_m"] = round(distance, 2)
                latest_alignment["offset_m"] = round(x_offset, 2)
                latest_alignment["aligned"] = abs(x_offset) < 0.10 

                # 2. ADD THIS BACK: Print the live data to the terminal
                print(f"Distance: {latest_alignment['distance_m']}m | Offset: {latest_alignment['offset_m']}m | Aligned: {latest_alignment['aligned']}")

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