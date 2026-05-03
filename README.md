Welcome!

**FlagFinder**: A react native mobile app which does hole alignment using a 10x10cm ArUco tag and a phone's camera. OpenCV2 frameworks run the underlying computer vision for alignment.

**AprilAlign**: A react native mobile app which does hole alignment using a 15x15cm ArUco tag and an external raspberry pi camera device. This app acts as a central device receiving real-time alignment status from a raspberry pi peripheral and presenting alignment cues to the user via TTS.

**GreenReader**: A react native mobile app which communicates the terrain of a given putt to the golfer via TTS. This app uses orientation sensors built into the iPhone to get pitch and roll measurements, informing whether the putt is uphill/downhill or breaking left/right. With a given distance in mind, we perform a calculation of how many cups to the left/right the golfer should aim.

**main.py** and **ble_service.py** provide the code for the peripheral bluetooth device, the raspberry pi.
