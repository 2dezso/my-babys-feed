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
# Apple requires apps to target iOS 15 or later from April 2027 (warning ITMS-90068); Capacitor's template says 14. The lock
# screen timer needs 16.2 (its current calls), so the whole app targets 16.2.
sed -i.bak "s/'14.0'/'16.2'/g" ios/App/Podfile
sed -i.bak 's/IPHONEOS_DEPLOYMENT_TARGET = 14.0;/IPHONEOS_DEPLOYMENT_TARGET = 16.2;/g' ios/App/App.xcodeproj/project.pbxproj
rm -f ios/App/Podfile.bak ios/App/App.xcodeproj/project.pbxproj.bak
grep -q "platform :ios, '16.2'" ios/App/Podfile || { echo "could not raise the Podfile to iOS 16.2"; grep -n platform ios/App/Podfile; exit 1; }
grep -q 'IPHONEOS_DEPLOYMENT_TARGET = 16.2;' ios/App/App.xcodeproj/project.pbxproj || { echo "could not raise the project to iOS 16.2"; exit 1; }
npx cap sync ios

# 3. The app icon, from the same 1024px icon the website uses.
mkdir -p assets
cp icon-1024.png assets/icon-only.png
# The launch screen: the app's own background with its icon, light and dark, in place of Capacitor's blank one.
cp scripts/ios-files/splash.png assets/splash.png
cp scripts/ios-files/splash-dark.png assets/splash-dark.png
npx @capacitor/assets generate --ios

# 4. Settings Apple asks about:
#    - the name under the icon on the home screen (it has to be short)
#    - "no special encryption", so App Store Connect does not ask the export question every upload
PLIST=ios/App/App/Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Little Sips" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Little Sips" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"

# 5. iPhone only, upright only, and the reasons iOS shows when the photo picker offers the camera. Without a camera
#    reason, tapping "Take Photo" in Moments would crash the app, which is a common cause of App Review rejection.
set_string() {
  /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"
}
set_string NSCameraUsageDescription "Take a photo to add to a Moment, such as a first smile."
set_string NSPhotoLibraryUsageDescription "Choose a photo to add to a Moment."
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" "$PLIST" 2>/dev/null || true
sed -i.bak 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' ios/App/App.xcodeproj/project.pbxproj
rm -f ios/App/App.xcodeproj/project.pbxproj.bak
grep -q 'TARGETED_DEVICE_FAMILY = 1;' ios/App/App.xcodeproj/project.pbxproj || { echo "could not make the app iPhone only"; exit 1; }

# 6. Apple's privacy file. Capacitor's template may already list one in the project; if not, it is added with the
#    xcodeproj tool that comes with CocoaPods (installed on GitHub's Macs).
cp scripts/ios-files/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
if ! grep -q "PrivacyInfo.xcprivacy" ios/App/App.xcodeproj/project.pbxproj; then
  ruby -e '
    require "xcodeproj"
    project = Xcodeproj::Project.open("ios/App/App.xcodeproj")
    target = project.targets.find { |t| t.name == "App" }
    ref = project.main_group["App"].new_reference("PrivacyInfo.xcprivacy")
    target.add_resources([ref])
    project.save
  '
fi
grep -q "PrivacyInfo.xcprivacy" ios/App/App.xcodeproj/project.pbxproj || { echo "privacy file not added to the project"; exit 1; }

# 7. The lock screen timer for a running feed (a Live Activity): the app says it uses them, its screen registers the plugin
#    the web app calls, and a small extension draws the timer. See scripts/ios-live-activity.rb.
/usr/libexec/PlistBuddy -c "Add :NSSupportsLiveActivities bool true" "$PLIST" 2>/dev/null   || /usr/libexec/PlistBuddy -c "Set :NSSupportsLiveActivities true" "$PLIST"
STORYBOARD=ios/App/App/Base.lproj/Main.storyboard
sed -i.bak 's/customClass="CAPBridgeViewController" customModule="Capacitor"/customClass="MainViewController" customModule="App" customModuleProvider="target"/' "$STORYBOARD"
rm -f "$STORYBOARD.bak"
grep -q 'customClass="MainViewController"' "$STORYBOARD" || { echo "could not point the main screen at MainViewController"; grep -n customClass "$STORYBOARD"; exit 1; }
ruby scripts/ios-live-activity.rb
grep -q "LiveActivity.appex" ios/App/App.xcodeproj/project.pbxproj || { echo "lock screen timer extension not added to the project"; exit 1; }

echo "iPhone project ready in ios/App"
