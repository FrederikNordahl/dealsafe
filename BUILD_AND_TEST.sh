#!/bin/bash

echo "🚀 Building DealSafe for TestFlight (Fixed Version)"
echo "=================================================="
echo ""
echo "Changes applied:"
echo "✅ Removed expo-blur (BlurView) - this was causing the crash"
echo "✅ Disabled New Architecture"
echo "✅ Added proper plugin configurations"
echo ""
echo "Building iOS production version..."
echo ""

# Build for production
eas build --platform ios --profile production

echo ""
echo "After the build completes:"
echo "1. The crash should be fixed!"
echo "2. Submit to TestFlight with: eas submit --platform ios"
echo ""
echo "Or auto-submit after build with:"
echo "eas build --platform ios --profile production --auto-submit"

