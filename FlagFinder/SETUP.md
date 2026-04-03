# Flag Finder — Build & Setup Guide

## What it does
Detects AruCo marker **ID 121** (DICT_ARUCO_ORIGINAL) on the flag using the phone
camera and speaks left/right cues to help you align your putt line.  
Portrait mode only.

---

## Step 1 — Install JS dependencies

```bash
cd FlagFinder
npm install
```

---

## Step 2 — Generate the native iOS project

```bash
npx expo prebuild --platform ios --clean
```

This creates `ios/FlagFinder/`, `ios/FlagFinder.xcodeproj/`, etc.

---

## Step 3 — Copy the OpenCV framework

Copy `opencv2.framework` from the working CameraAlignmentClaude project:

```bash
cp -r ../CameraAlignmentClaude/ios/opencv2.framework ./ios/opencv2.framework
```

---

## Step 4 — Add the native plugin to Xcode

Open `ios/FlagFinder.xcworkspace` in Xcode, then:

1. **Add source files**  
   - In the Project Navigator, right-click the `FlagFinder` group → *Add Files to "FlagFinder"*  
   - Select `ios/ArucoDetectorPlugin.h` and `ios/ArucoDetectorPlugin.mm`  
   - Ensure *Target Membership* → `FlagFinder` is checked

2. **Add opencv2.framework**  
   - Right-click the `FlagFinder` group → *Add Files to "FlagFinder"*  
   - Select `ios/opencv2.framework`  
   - Check *Copy items if needed*

3. **Link the framework**  
   - Select the `FlagFinder` target → *General* → *Frameworks, Libraries, and Embedded Content*  
   - Confirm `opencv2.framework` is listed as **Embed & Sign**

4. **Add a "Restore OpenCV Binary" Run Script phase** *(same as CameraAlignmentClaude)*  
   - Target → *Build Phases* → `+` → *New Run Script Phase*  
   - Paste the script from `CameraAlignmentClaude`'s Xcode project  
   - Move it **after** the "Embed Frameworks" phase

5. **Header search path**  
   - Target → *Build Settings* → search `Header Search Paths`  
   - Add: `$(SRCROOT)/opencv2.framework/Headers` (non-recursive)

---

## Step 5 — Install CocoaPods

```bash
cd ios
pod install
cd ..
```

---

## Step 6 — Build & run

```bash
npx expo run:ios --device
```

Or open `ios/FlagFinder.xcworkspace` in Xcode and press ▶.

---

## AruCo tag

Print a **DICT_ARUCO_ORIGINAL ID 121** marker at ~10 cm × 10 cm and attach it to the flag.  
You can generate one at: https://chev.me/arucogen/ (Dictionary: Original ArUco, Marker ID: 121)

---

## Calibration

Edit `constants/calibration.ts` if your printed marker is a different size than 10 cm.  
Update `KNOWN_WIDTH_CM` to match the actual printed width.
