# Push Notifications Setup Guide

This guide covers everything you need to do on both **Expo** and **Apple** sides to enable push notifications for your DealSafe app.

## 📱 Expo Side Setup

### 1. Update app.json (Already Done ✅)

The `expo-notifications` plugin is already configured in your `app.json`. However, you may want to add additional iOS-specific configuration:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        // Add notification permission description
        "NSUserNotificationsUsageDescription": "We'll remind you when your vouchers are about to expire."
      }
    }
  }
}
```

### 2. Configure EAS Credentials

EAS will automatically handle push notification credentials, but you need to ensure credentials are set up:

```bash
# Login to EAS (if not already)
eas login

# Configure credentials for iOS
eas credentials

# Select your project and iOS platform
# EAS will automatically generate and manage APNs keys
```

### 3. Build with EAS

When you build with EAS, push notification capabilities are automatically added:

```bash
eas build --platform ios --profile production
```

**Note:** EAS automatically:
- Generates APNs Key/Certificate
- Adds Push Notifications capability to your app
- Configures the app bundle with proper entitlements

---

## 🍎 Apple Side Setup

### Step 1: Enable Push Notifications in Apple Developer Portal

1. **Go to Apple Developer Portal**
   - Visit: https://developer.apple.com/account
   - Sign in with your Apple Developer account

2. **Navigate to Certificates, Identifiers & Profiles**
   - Click on "Certificates, Identifiers & Profiles" in the left sidebar

3. **Select Your App Identifier**
   - Click "Identifiers" in the left sidebar
   - Find and select your app: `com.desperate.dealsafe`
   - If it doesn't exist, create a new App ID

4. **Enable Push Notifications Capability**
   - In the App ID details page, scroll to "Capabilities"
   - Check the box for **"Push Notifications"**
   - Click "Save"

### Step 2: Create APNs Key (Recommended) or Certificate

**Option A: APNs Key (Recommended - Easier and More Flexible)**

1. **Go to Keys Section**
   - In Apple Developer Portal, click "Keys" in the left sidebar
   - Click the "+" button to create a new key

2. **Configure the Key**
   - **Key Name:** `DealSafe Push Notifications Key` (or any name you prefer)
   - **Enable:** Check "Apple Push Notifications service (APNs)"
   - Click "Continue" then "Register"

3. **Download the Key**
   - **IMPORTANT:** Download the `.p8` key file immediately
   - You can only download it once!
   - Note the **Key ID** (you'll need this)

4. **Note Your Team ID**
   - In the top right of Apple Developer Portal, note your **Team ID** (10-character string)

**Option B: APNs Certificate (Alternative)**

If you prefer certificates instead of keys:
1. Go to "Certificates" → "+" → "Apple Push Notification service SSL"
2. Select your App ID
3. Follow the certificate creation wizard
4. Download and install the certificate

### Step 3: Configure in App Store Connect (Optional)

If you're submitting to the App Store:
1. Go to App Store Connect
2. Select your app
3. Push notifications are automatically enabled if configured in Developer Portal

---

## 🔑 EAS Credentials Configuration

### Automatic (Recommended)

EAS can automatically manage your push notification credentials:

```bash
# This will prompt you to upload your APNs key or let EAS generate it
eas credentials

# Select: iOS → Push Notifications
# Choose: "Let EAS handle the credentials management"
```

### Manual (If you created the key yourself)

If you created an APNs key manually:

1. **Upload to EAS:**
   ```bash
   eas credentials
   # Select: iOS → Push Notifications
   # Choose: "Upload credentials"
   # Provide:
   #   - Key ID (from Apple Developer Portal)
   #   - Team ID (from Apple Developer Portal)
   #   - .p8 key file path
   ```

2. **Or use environment variables:**
   ```bash
   # In your .env or eas.json
   EXPO_APPLE_TEAM_ID=YOUR_TEAM_ID
   EXPO_APPLE_APNS_KEY_ID=YOUR_KEY_ID
   EXPO_APPLE_APNS_KEY_PATH=./path/to/key.p8
   ```

---

## ✅ Verification Checklist

After setup, verify everything is working:

### 1. Check app.json
- [x] `expo-notifications` plugin is configured
- [ ] (Optional) Notification permission description added

### 2. Check Apple Developer Portal
- [ ] App ID exists: `com.desperate.dealsafe`
- [ ] Push Notifications capability is enabled
- [ ] APNs Key or Certificate is created

### 3. Check EAS Credentials
```bash
eas credentials
# Verify Push Notifications shows as configured
```

### 4. Test in Development

After building, test that:
- [ ] App requests notification permission
- [ ] Permission is granted
- [ ] Token is registered with your backend
- [ ] Backend can send notifications to the token

---

## 🧪 Testing Push Notifications

### 1. Get a Test Token

Your app already registers tokens with your backend. Check your backend logs to see if tokens are being received.

### 2. Send a Test Notification

You can test using Expo's push notification tool:

```bash
# Install expo-notifications CLI tool
npm install -g expo-notifications-cli

# Send a test notification
# (You'll need the Expo Push Token from your app)
```

Or use your backend API to send notifications using the registered tokens.

### 3. Test on Device

**Important:** Push notifications only work on **physical devices**, not simulators.

1. Build and install on a physical iOS device
2. Grant notification permission
3. Verify token is registered
4. Send a test notification from your backend

---

## 🔧 Troubleshooting

### "No valid 'aps-environment' entitlement"

**Solution:** Make sure Push Notifications capability is enabled in:
1. Apple Developer Portal (App ID)
2. EAS credentials are properly configured

### "Invalid token" or "Token not registered"

**Solution:**
1. Verify the token is being sent to your backend correctly
2. Check that your backend is using the correct APNs endpoint (production vs sandbox)
3. Ensure the token format is correct

### Notifications not appearing

**Solution:**
1. Check notification permission is granted in iOS Settings
2. Verify the app is not in "Do Not Disturb" mode
3. Check notification settings in iOS Settings → Notifications → DealSafe
4. Ensure you're testing on a physical device (not simulator)

### EAS Build Fails with Credential Errors

**Solution:**
```bash
# Clear and reconfigure credentials
eas credentials --clear
eas credentials
# Follow the prompts to set up push notifications
```

---

## 📚 Additional Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [EAS Credentials Documentation](https://docs.expo.dev/app-signing/managed-credentials/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [APNs Key vs Certificate](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)

---

## 🚀 Quick Start Commands

```bash
# 1. Configure EAS credentials (first time)
eas credentials

# 2. Build with push notification support
eas build --platform ios --profile production

# 3. Test on device
# Install the build on a physical iOS device

# 4. Verify token registration
# Check your backend logs for registered tokens
```

---

**Note:** The easiest approach is to let EAS automatically manage your push notification credentials. Just run `eas credentials` and select "Let EAS handle the credentials management" when prompted.

