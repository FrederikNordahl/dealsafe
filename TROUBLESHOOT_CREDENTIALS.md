# Troubleshooting EAS Credentials GraphQL Error

## Current Issue
Getting "Unexpected server error" when trying to set up credentials via EAS.

## Solutions to Try (In Order)

### 1. Update EAS CLI ✅ (Doing this now)
```bash
npm install -g eas-cli@latest
```

### 2. Re-authenticate with Expo
```bash
# Log out and log back in
eas logout
eas login
```

### 3. Check Expo Service Status
- Visit: https://status.expo.dev
- Check if there are any ongoing issues with the GraphQL API

### 4. Try Using Web Interface
```bash
# Open credentials in browser (sometimes more reliable)
eas credentials --web
```

### 5. Clear EAS Cache
```bash
# Clear local cache
rm -rf ~/.expo
rm -rf ~/.eas

# Then try again
eas credentials -p ios
```

### 6. Try Building Directly (EAS May Auto-Fix)
Sometimes building will trigger credential generation automatically:
```bash
eas build --platform ios --profile production
```

### 7. Manual Credential Setup (Last Resort)
If EAS continues to fail, you can manually set up credentials:

1. **Go to Apple Developer Portal:**
   - https://developer.apple.com/account
   - Create/verify your App ID: `com.desperate.dealsafe`
   - Enable Push Notifications capability

2. **Create Distribution Certificate:**
   - Certificates → "+" → "Apple Distribution"
   - Download and install

3. **Create Provisioning Profile:**
   - Profiles → "+" → "App Store"
   - Select your App ID and certificate
   - Download and install

4. **Upload to EAS:**
   ```bash
   eas credentials -p ios
   # Choose "Upload credentials" instead of "Let EAS handle"
   ```

### 8. Contact Expo Support
If nothing works, contact Expo support with:
- Error ID: `7e6ca39e-6ab0-4ed3-8c1c-e951b5a06fe6`
- Request ID: `7e6ca39e-6ab0-4ed3-8c1c-e951b5a06fe6`
- Link: https://expo.dev/contact

---

## Alternative: Skip Credentials for Now

If you just need to build and credentials are blocking you:

1. **Try building anyway:**
   ```bash
   eas build --platform ios --profile production
   ```
   EAS might auto-generate credentials during the build process.

2. **Use local build (if you have Xcode):**
   ```bash
   eas build --platform ios --profile production --local
   ```
   This bypasses EAS credential management.

---

## Most Likely Causes

1. **Temporary Expo Server Issue** (Most Common)
   - Wait 10-15 minutes and try again
   - Check status.expo.dev

2. **Outdated CLI** (Fixing now)
   - Update to latest version

3. **Authentication Token Expired**
   - Re-login with `eas logout && eas login`

4. **Project Configuration Issue**
   - Verify project ID in app.json matches Expo dashboard

---

## Quick Test After Fixing

```bash
# 1. Update CLI
npm install -g eas-cli@latest

# 2. Re-authenticate
eas logout
eas login

# 3. Try credentials again
eas credentials -p ios

# 4. If still fails, try building directly
eas build --platform ios --profile production
```

