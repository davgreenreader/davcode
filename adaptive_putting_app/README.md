# adaptive_putting_app

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## FOR TERRY
# iPhone Setup Guide for Adaptive Golf Putter App

## What You Need
- Mac computer
- iPhone with USB cable
- ~1 hour (mostly waiting for downloads)
- Any Apple ID (free, can be personal)

---

## Part 1: Install Tools on Mac (One Time)

### Step 1: Install Xcode
1. Open **App Store** on Mac
2. Search **"Xcode"**
3. Click **Get/Install** (free, but ~12GB so takes a while)
4. Once installed, open Xcode
5. Click **Agree** to accept license
6. Close Xcode

### Step 2: Install Xcode Command Line Tools
Open **Terminal** app (search "Terminal" in Spotlight) and run:
```bash
xcode-select --install
```
Click **Install** when prompted.

### Step 3: Install Flutter
Copy and paste these commands into Terminal, one at a time:

```bash
cd ~
```

```bash
git clone https://github.com/flutter/flutter.git -b stable
```

```bash
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.zshrc
```

```bash
source ~/.zshrc
```

```bash
flutter doctor
```

You should see some checkmarks. Don't worry if some things show X - we mainly need iOS to work.

### Step 4: Install CocoaPods
```bash
sudo gem install cocoapods
```
Enter your Mac password when asked (you won't see characters as you type - that's normal).

---

## Part 2: Get the Project Code

### Option A: If using GitHub
```bash
cd ~/Desktop
git clone YOUR_GITHUB_REPO_URL
cd adaptive_putting_app
```

### Option B: If using USB drive or cloud storage
1. Copy the project folder to Desktop
2. In Terminal:
```bash
cd ~/Desktop/adaptive_putting_app
```

---

## Part 3: Setup the Project

Run these commands one at a time:

```bash
flutter pub get
```

```bash
cd ios
```

```bash
pod install
```

```bash
cd ..
```

---

## Part 4: Setup Apple Signing

### Step 1: Open Project in Xcode
```bash
open ios/Runner.xcworkspace
```

### Step 2: Configure Signing
1. In Xcode, click **Runner** in the left sidebar (folder icon at top)
2. In the middle panel, click **Runner** under "TARGETS"
3. Click **Signing & Capabilities** tab
4. Check the box **"Automatically manage signing"**
5. Next to **Team**, click the dropdown
6. Click **Add an Account...**
7. Sign in with your Apple ID (any personal Apple ID works)
8. Select your account as the Team
9. **Important:** Change **Bundle Identifier** to something unique:
   ```
   com.YOURNAME.adaptivegolfputter
   ```
   (Replace YOURNAME with your actual name, no spaces)

If you see a checkmark and no red errors, you're good!

---

## Part 5: Connect iPhone

### Step 1: Plug In iPhone
Connect iPhone to Mac with USB cable.

### Step 2: Trust the Computer
On your iPhone, tap **Trust** when asked "Trust This Computer?"

Enter your iPhone passcode if asked.

### Step 3: Verify Connection
In Terminal:
```bash
flutter devices
```

You should see your iPhone listed like:
```
iPhone (mobile) • abc123 • ios • iOS 17.0
```

---

## Part 6: Run the App!

In Terminal, make sure you're in the project folder:
```bash
cd ~/Desktop/adaptive_putting_app
```

Then run:
```bash
flutter run
```

Wait for it to build (first time takes 2-5 minutes).

---

## Part 7: Trust the App on iPhone (First Time Only)

You'll probably see an error about "untrusted developer". 

On your **iPhone**:
1. Go to **Settings**
2. Tap **General**
3. Scroll down and tap **VPN & Device Management**
4. Under "Developer App", tap your Apple ID email
5. Tap **Trust "[your email]"**
6. Tap **Trust** again to confirm

Now go back to Terminal and run again:
```bash
flutter run
```

The app should launch on the iPhone! 🎉

---

## Part 8: Enable Wireless Debugging (Optional but Helpful)

So you don't need the cable every time:

1. Keep iPhone connected via USB
2. In Xcode, go to **Window → Devices and Simulators**
3. Select your iPhone on the left
4. Check the box **"Connect via network"**
5. Wait for a globe icon to appear next to your iPhone

Now you can unplug the cable. As long as Mac and iPhone are on the same WiFi, you can run:
```bash
flutter run
```

---

## Quick Reference: Running the App Later

After initial setup, you only need to:

```bash
cd ~/Desktop/adaptive_putting_app
flutter run
```

---

## Troubleshooting

### "No devices found"
- Make sure iPhone is unlocked
- Unplug and replug the cable
- On iPhone, tap "Trust" if prompted

### "Signing error" or "No Team"
- Open Xcode, go to Runner → Signing & Capabilities
- Make sure Team is selected and Bundle Identifier is unique

### "Untrusted Developer"
- On iPhone: Settings → General → VPN & Device Management → Trust

### Build fails with weird errors
```bash
cd ios
pod deintegrate
pod install
cd ..
flutter clean
flutter pub get
flutter run
```

---

## Need to Update the App Later?

If the code changes:

1. Get the new code (pull from GitHub or copy new folder)
2. Run:
```bash
cd ~/Desktop/adaptive_putting_app
flutter pub get
flutter run
```

---

## Questions?

Text/call [YOUR PHONE NUMBER] if you get stuck!
