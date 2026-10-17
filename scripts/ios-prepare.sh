#!/usr/bin/env bash
# Builds the iPhone project from the website files. Runs on a Mac (the GitHub cloud Mac, or your own).
#
#   bash scripts/ios-prepare.sh
#
# Afterwards ios/App holds a complete Xcode project: the app's files, its icon, and its settings.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. The website files the app is made from.
bash scripts/build-www.sh

# 2. The Xcode project (made fresh each time, so nothing generated needs committing).
rm -rf ios
npx cap add ios
npx cap sync ios

# 3. The app icon, from the same 1024px icon the website uses.
mkdir -p assets
cp icon-1024.png assets/icon-only.png
npx @capacitor/assets generate --ios

# 4. Settings Apple asks about:
#    - the name under the icon on the home screen (it has to be short)
#    - "no special encryption", so App Store Connect does not ask the export question every upload
PLIST=ios/App/App/Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Charlie's Year" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Charlie's Year" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"

echo "iPhone project ready in ios/App"
