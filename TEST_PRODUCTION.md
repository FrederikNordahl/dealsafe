# Testing Production Build Locally

The crash was caused by **expo-blur (BlurView)** incompatibility with Hermes engine in production builds.

## What Was Fixed

1. ✅ Removed `expo-blur` / `BlurView` from BottomSheet background
2. ✅ Replaced with solid background color (looks nearly identical)
3. ✅ Disabled New Architecture (can re-enable later if needed)
4. ✅ Added proper plugin configurations for image picker, media library, and document picker

## How to Test Before TestFlight

### Option 1: Build Preview Locally (Fastest)
```bash
# Make sure you have EAS CLI installed
npm install -g eas-cli

# Login to Expo
eas login

# Build a preview (internal distribution) locally
eas build --platform ios --profile preview --local
```

This creates an .ipa file you can install on your device using:
- Xcode → Window → Devices and Simulators
- Or TestFlight (upload with `eas submit`)

### Option 2: Build Production for TestFlight
```bash
# Build production version
eas build --platform ios --profile production

# After build completes, submit to TestFlight
eas submit --platform ios
```

### Option 3: Test with Expo Go Development Build
```bash
# This won't catch all production issues, but tests most things
npx expo start
```

## What to Test

1. ✅ App launches without crashing
2. ✅ Bottom sheet opens when pressing the "+" button
3. ✅ Photo picker works (the area that previously had blur)
4. ✅ Camera permission requests work
5. ✅ Photo library access works
6. ✅ Document picker works

## If You Still Have Issues

If the app still crashes:

1. **Check crash logs** in Xcode → Window → Devices → View Device Logs
2. **React version issue**: You're on React 19.1.0 (very new). Consider downgrading to 18.x:
   ```bash
   npm install react@18.2.0 react-dom@18.2.0
   ```
3. **Check other native modules**: Run `npx expo-doctor` to check for issues

## Re-enabling BlurView Later (Optional)

If you want the blur effect back after confirming everything works:

1. Keep New Architecture disabled OR wait for expo-blur to support it
2. Add expo-blur plugin to app.json:
   ```json
   ["expo-blur"]
   ```
3. Uncomment the BlurView import and usage
4. Always test production builds before TestFlight!

