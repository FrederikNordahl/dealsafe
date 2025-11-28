# EAS Credentials Management Guide

This guide shows you how to manage, regenerate, and fix provisioning profiles and certificates in EAS.

## 🔑 Quick Commands

### View Current Credentials
```bash
eas credentials
```

### Regenerate All Credentials
```bash
# Clear and regenerate all credentials
eas credentials --clear
eas credentials
```

### Regenerate Specific Credential Type
```bash
# For iOS provisioning profiles
eas credentials -p ios

# For distribution certificates
eas credentials -p ios --type distribution

# For push notification keys
eas credentials -p ios --type push-notification
```

---

## 📋 Step-by-Step: Regenerating Provisioning Profiles

### Option 1: Interactive Mode (Recommended)

1. **Open credentials manager:**
   ```bash
   eas credentials
   ```

2. **Select your project:**
   - Choose your project from the list
   - Select **iOS** platform

3. **Choose credential type:**
   - **Provisioning Profile** - For app signing
   - **Distribution Certificate** - For App Store/TestFlight
   - **Push Notification Key** - For push notifications

4. **Regenerate:**
   - Select the credential you want to regenerate
   - Choose **"Remove"** or **"Regenerate"**
   - Follow prompts to create new credentials

### Option 2: Clear and Start Fresh

If credentials are corrupted or expired:

```bash
# 1. Clear all iOS credentials
eas credentials -p ios --clear

# 2. Reconfigure credentials interactively
eas credentials -p ios

# 3. Choose "Let EAS handle the credentials management"
#    This will automatically generate new ones
```

---

## 🔄 Common Scenarios

### Scenario 1: Provisioning Profile Expired

**Symptoms:**
- Build fails with "Invalid provisioning profile"
- "Provisioning profile has expired"

**Solution:**
```bash
# Regenerate provisioning profile
eas credentials -p ios

# Select: Provisioning Profile → Remove → Create New
# OR let EAS auto-generate: "Let EAS handle credentials"
```

### Scenario 2: Distribution Certificate Invalid

**Symptoms:**
- "Certificate not found"
- "Invalid certificate"

**Solution:**
```bash
# Regenerate distribution certificate
eas credentials -p ios --type distribution

# Remove old certificate and create new one
# EAS will handle the Apple Developer Portal setup
```

### Scenario 3: Push Notification Key Missing

**Symptoms:**
- Push notifications not working
- "APNs key not configured"

**Solution:**
```bash
# Configure push notification credentials
eas credentials -p ios

# Select: Push Notifications
# Choose: "Let EAS handle the credentials management"
# OR upload your own APNs key if you have one
```

### Scenario 4: Complete Credential Reset

**When to use:**
- Multiple credential issues
- After changing Apple Developer account
- Starting fresh

**Solution:**
```bash
# 1. Clear all credentials
eas credentials -p ios --clear

# 2. Rebuild credentials from scratch
eas credentials -p ios

# 3. For each credential type, choose:
#    "Let EAS handle the credentials management"
```

---

## 🍎 Apple Developer Portal Setup

EAS can automatically create credentials in Apple Developer Portal, but you need:

### Required Permissions:
1. **App ID exists** in Apple Developer Portal
   - Bundle ID: `com.desperate.dealsafe`
   - Should already exist if you've built before

2. **Apple Developer Account Access**
   - EAS needs access to create/manage certificates
   - You'll be prompted to authenticate

### If EAS Can't Auto-Generate:

You may need to manually enable capabilities in Apple Developer Portal:

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select your App ID: `com.desperate.dealsafe`
4. Enable required capabilities:
   - ✅ Push Notifications (if using notifications)
   - ✅ App Groups (if using app groups)
5. Save changes
6. Run `eas credentials` again

---

## 🔍 Checking Credential Status

### View Credentials Online
```bash
# Open EAS dashboard in browser
eas credentials --web
```

### List All Credentials
```bash
# See all credentials for your project
eas credentials -p ios --list
```

### Check Specific Credential
```bash
# Check provisioning profile
eas credentials -p ios --type provisioning-profile

# Check distribution certificate
eas credentials -p ios --type distribution-certificate
```

---

## 🛠️ Troubleshooting

### Error: "Credentials not found"

**Solution:**
```bash
# Regenerate credentials
eas credentials -p ios
# Choose "Let EAS handle credentials"
```

### Error: "Invalid Apple Developer credentials"

**Solution:**
```bash
# Re-authenticate with Apple
eas credentials -p ios
# You'll be prompted to sign in to Apple Developer Portal
```

### Error: "Provisioning profile doesn't match bundle ID"

**Solution:**
1. Verify bundle ID in `app.json` matches Apple Developer Portal
2. Regenerate provisioning profile:
   ```bash
   eas credentials -p ios --type provisioning-profile
   ```

### Error: "Certificate expired"

**Solution:**
```bash
# Regenerate distribution certificate
eas credentials -p ios --type distribution-certificate
# Remove old → Create new
```

### GraphQL Errors (Like you saw)

**Solution:**
```bash
# 1. Update EAS CLI
npm install -g eas-cli@latest

# 2. Clear credentials cache
eas credentials -p ios --clear

# 3. Re-authenticate
eas login

# 4. Regenerate credentials
eas credentials -p ios
```

---

## 📝 Credential Types Explained

### 1. **Distribution Certificate**
- Used to sign your app for App Store/TestFlight
- Valid for 1 year
- EAS can auto-generate and renew

### 2. **Provisioning Profile**
- Links your app to your distribution certificate
- Contains your bundle ID and capabilities
- EAS can auto-generate

### 3. **Push Notification Key (APNs)**
- For sending push notifications
- Can be key (.p8) or certificate
- EAS can auto-generate

### 4. **Development Certificate** (if using development builds)
- For local development
- Different from distribution certificate

---

## 🚀 Recommended Workflow

### For New Projects:
```bash
# 1. Let EAS handle everything automatically
eas credentials -p ios
# Choose: "Let EAS handle the credentials management"

# 2. Build
eas build --platform ios --profile production
```

### For Existing Projects (Regenerating):
```bash
# 1. Check current status
eas credentials -p ios

# 2. If issues, clear and regenerate
eas credentials -p ios --clear
eas credentials -p ios
# Choose: "Let EAS handle the credentials management"

# 3. Build
eas build --platform ios --profile production
```

---

## ⚠️ Important Notes

1. **EAS Auto-Management is Recommended**
   - EAS can automatically generate and renew credentials
   - Less manual work, fewer errors
   - Choose "Let EAS handle credentials" when prompted

2. **Credentials Expire**
   - Distribution certificates: 1 year
   - Provisioning profiles: 1 year
   - EAS can auto-renew if configured

3. **Don't Delete Manually**
   - If you delete credentials in Apple Developer Portal manually, EAS won't know
   - Always use `eas credentials` to manage credentials

4. **Multiple Environments**
   - Development, Preview, and Production use different credentials
   - EAS manages them separately

---

## 🔗 Additional Resources

- [EAS Credentials Documentation](https://docs.expo.dev/app-signing/managed-credentials/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple Developer Portal](https://developer.apple.com/account)

---

## 💡 Quick Fix for Your Current Issue

Based on the GraphQL error you saw, try this:

```bash
# 1. Update EAS CLI
npm install -g eas-cli@latest

# 2. Clear and regenerate credentials
eas credentials -p ios --clear
eas credentials -p ios

# 3. When prompted, choose:
#    "Let EAS handle the credentials management"

# 4. Build again
eas build --platform ios --profile production
```

This should resolve most credential-related issues!

