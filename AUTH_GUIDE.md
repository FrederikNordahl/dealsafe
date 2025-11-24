# Authentication Implementation Guide

## ✅ What's Been Implemented

### 1. **Authentication Utilities** (`/utils/auth.ts`)
- `AuthStorage.setToken(token)` - Save JWT token
- `AuthStorage.getToken()` - Get JWT token
- `AuthStorage.setUser(user)` - Save user data
- `AuthStorage.getUser()` - Get user data
- `AuthStorage.clear()` - Clear all auth data

### 2. **Phone Number Screen** (`/components/auth/PhoneNumberScreen.tsx`)
- Phone number input with dark theme styling
- Calls `POST /api/auth/request-otp`
- Shows OTP code in development mode
- Error handling and loading states

### 3. **OTP Verification Screen** (`/components/auth/OtpScreen.tsx`)
- 6-digit code input with individual boxes
- Spacing between each digit
- Auto-advance and auto-submit
- Paste support for full 6-digit codes
- Calls `POST /api/auth/verify-otp`
- "Change phone number" button to go back

### 4. **Main App Integration** (`/app/index.tsx`)
- Auth state management
- Token persistence check on app start
- Protected API requests with JWT tokens
- Session expiry handling (401 responses)
- Conditional rendering without breaking routing

## 🔄 Authentication Flow

```
App Launch
    ↓
Check AsyncStorage for Token
    ↓
├─ Token Found → Show Main App
│
└─ No Token → Show Phone Screen
               ↓
          Enter Phone Number
               ↓
          POST /api/auth/request-otp
               ↓
          Show OTP Screen
               ↓
          Enter 6-Digit Code
               ↓
          POST /api/auth/verify-otp
               ↓
          Save Token & User
               ↓
          Show Main App
```

## 🎨 Design Consistency

All auth screens match your existing design:
- Background: `#010101`
- Cards: `#202020`
- Text: `#FFFFFF`
- Buttons: White with black text
- Border radius: 24px for buttons, 16px for inputs

## 🔐 Security Features

✅ JWT tokens stored securely in AsyncStorage
✅ All API requests include `Authorization: Bearer <token>` header
✅ 401 responses automatically log out user
✅ Token persists across app restarts
✅ One-time use OTP codes

## 🧪 Testing

### Development Mode
The backend returns the OTP code in the response when `NODE_ENV=development`:
```json
{
  "success": true,
  "code": "123456"
}
```

### Test Flow
1. Start app (shows phone screen if not authenticated)
2. Enter: `+4512345678`
3. Check alert for OTP code (dev mode)
4. Enter 6-digit code
5. App should show main screen
6. Close and reopen app - should stay logged in

## 📝 Key Implementation Details

### Stable Component Structure
The app always returns a single `<View>` with conditional content inside to prevent routing loops:

```tsx
return (
  <View style={styles.container}>
    {isCheckingAuth && <LoadingSpinner />}
    {!isCheckingAuth && !isAuthenticated && <AuthScreens />}
    {!isCheckingAuth && isAuthenticated && <MainApp />}
  </View>
);
```

This approach avoids the "Maximum update depth exceeded" error by keeping the component tree stable.

### Protected API Calls
All voucher-related API calls now include the auth token:

```tsx
fetch(`${API_URL}/api/vouchers`, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
  },
})
```

### Session Management
- Tokens expire after 30 days (backend configured)
- 401 responses clear stored auth and show login screen
- User can logout by clearing AsyncStorage

## 🚀 Next Steps

Optional enhancements:
- Add logout button in settings
- Implement biometric auth (Face ID/Touch ID)
- Add "Remember device" feature
- Token refresh mechanism
- Account management screen

## 🐛 Troubleshooting

**Q: App stuck on loading screen?**
A: Clear AsyncStorage:
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
```

**Q: OTP code not working?**
A: Check that phone number includes country code (+45)

**Q: API returns 401?**
A: App should auto-logout. If not, manually clear AsyncStorage.

---

Built for DealSafe 🎉

