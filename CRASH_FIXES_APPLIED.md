# TestFlight Crash Fixes - Build #12

## 🚨 CRITICAL FIX: react-native-reanimated Import Order

**THE MAIN ISSUE**: `react-native-reanimated` import MUST be the FIRST import in root layout!

### What Was Fixed:

#### 1. **Reanimated Import Order** (app/_layout.tsx) ⚠️ CRITICAL
```typescript
// ❌ BEFORE (CAUSES CRASHES):
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';  // ❌ NOT FIRST!

// ✅ AFTER (FIXED):
import 'react-native-reanimated';  // ✅ MUST BE FIRST!

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
```

**Why this matters**: react-native-reanimated needs to install its global setup code before ANY other module. When it's not first, Hermes crashes in production.

#### 2. **Added Missing Plugins** (app.json)
```json
"plugins": [
  "expo-router",
  "react-native-reanimated/plugin",  // ✅ Added
  "react-native-gesture-handler",    // ✅ Added
  // ... other plugins
]
```

#### 3. **Moved GestureHandlerRootView to Root Layout**
- Moved from `app/index.tsx` → `app/_layout.tsx`
- This ensures gesture handler is initialized at the root level
- Prevents gesture handler crashes

#### 4. **Removed expo-blur** (Previous Fix)
- Completely removed from package.json
- Removed from code
- Replaced with solid background

## Summary of ALL Changes:

### app/_layout.tsx
- ✅ Moved `import 'react-native-reanimated'` to be FIRST import
- ✅ Added `GestureHandlerRootView` wrapper

### app/index.tsx
- ✅ Removed duplicate `GestureHandlerRootView`
- ✅ Removed `expo-blur` import and usage
- ✅ Replaced `BlurView` with `View`

### app.json
- ✅ Added `react-native-reanimated/plugin`
- ✅ Added `react-native-gesture-handler` plugin
- ✅ Added image picker, media library, document picker plugins
- ✅ Removed invalid statusBar configs

### package.json
- ✅ Removed `expo-blur`
- ✅ Updated packages to SDK 54 versions

## Next Steps:

### Build New Version:
```bash
cd /Users/frederiknordahl/Desktop/sites/dealsafe
eas build --platform ios --profile production
```

### After Build Completes:
```bash
eas submit --platform ios
```

## Why These Fixes Work:

1. **Reanimated import order**: The #1 cause of production crashes with @gorhom/bottom-sheet
2. **Missing plugins**: Without the plugins, native modules aren't properly configured
3. **GestureHandlerRootView placement**: Must wrap the entire app at root level
4. **No expo-blur**: Removed the incompatible module entirely

## What to Expect:

- App should launch successfully ✅
- Bottom sheet should work smoothly ✅
- No more Hermes crashes ✅
- Photo picker/camera should work ✅

---

**Build #12 should work!** These are the exact fixes for the most common React Native production crash patterns.

