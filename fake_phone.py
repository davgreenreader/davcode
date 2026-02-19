import asyncio
import websockets
import json

async def listen_to_server():
    # We connect to localhost because the server is running on the same machine right now.
    uri = "ws://localhost:8765" 
    print(f"Connecting to the vision server at {uri}...")
    
    try:
        # Open the connection
        async with websockets.connect(uri) as websocket:
            print("Connected! Listening for alignment data...\n")
            
            while True:
                # Wait for the JSON payload from the server
                message = await websocket.recv()
                
                # Parse the JSON string back into a Python dictionary
                data = json.loads(message)
                
                # Print it out exactly how the Flutter app will see it
                print(f"📱 App Received -> Distance: {data['distance_m']}m | Offset: {data['offset_m']}m | Aligned: {data['aligned']}")
                
    except websockets.exceptions.ConnectionClosed:
        print("Server disconnected.")
    except ConnectionRefusedError:
        print("Could not connect. Is vision_server.py running?")

if __name__ == "__main__":
    asyncio.run(listen_to_server())