# Adds the lock screen timer and the Siri phrases to the generated iPhone project: the plugins the web app talks to, the
# screen that registers them, and a small extension (a "widget extension" with no widgets) that draws the timer.
# Run from the repository root by scripts/ios-prepare.sh, after the project exists. Uses the xcodeproj tool that comes
# with CocoaPods. It stops with a clear message if anything it expects is not there.
require "fileutils"
require "xcodeproj"

ROOT = "ios/App"
FILES = "scripts/ios-files/live"
IOS = "16.2" # the first iPhone version with the current Live Activity calls

project = Xcodeproj::Project.open("#{ROOT}/App.xcodeproj")
app = project.targets.find { |t| t.name == "App" } or abort "no App target"
bundle_id = app.build_configurations.first.build_settings["PRODUCT_BUNDLE_IDENTIFIER"]
abort "no bundle id" if bundle_id.to_s.empty? || bundle_id.include?("getcapacitor")

# 1. The app's own new files.
app_group = project.main_group["App"] or abort "no App group"
%w[FeedActivityAttributes.swift LiveFeedPlugin.swift MainViewController.swift SiriShortcuts.swift SiriCommandPlugin.swift].each do |name|
  FileUtils.cp("#{FILES}/#{name}", "#{ROOT}/App/#{name}")
  app.add_file_references([app_group.new_reference(name)])
end

# 2. The extension: its own folder, its own settings, the shared attributes file.
FileUtils.mkdir_p("#{ROOT}/LiveActivity")
FileUtils.cp("#{FILES}/LiveActivity/FeedLiveActivity.swift", "#{ROOT}/LiveActivity/FeedLiveActivity.swift")
FileUtils.cp("#{FILES}/LiveActivity/Info.plist", "#{ROOT}/LiveActivity/Info.plist")
ext = project.new_target(:app_extension, "LiveActivity", :ios, IOS)
ext_group = project.main_group.new_group("LiveActivity", "LiveActivity")
ext.add_file_references([
  ext_group.new_reference("FeedLiveActivity.swift"),
  ext_group.new_reference("../App/FeedActivityAttributes.swift"),
])
ext_group.new_reference("Info.plist")

app_settings = app.build_configurations.first.build_settings
ext.build_configurations.each do |config|
  s = config.build_settings
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "#{bundle_id}.LiveActivity"
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["INFOPLIST_FILE"] = "LiveActivity/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["SWIFT_VERSION"] = "5.0"
  s["TARGETED_DEVICE_FAMILY"] = "1"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = IOS
  s["SKIP_INSTALL"] = "YES"
  s["CODE_SIGN_STYLE"] = "Automatic"
  s["MARKETING_VERSION"] = app_settings["MARKETING_VERSION"] || "1.0"
  s["CURRENT_PROJECT_VERSION"] = app_settings["CURRENT_PROJECT_VERSION"] || "1"
  s["LD_RUNPATHS_SEARCH_PATHS"] = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"
end

# 3. The app carries the extension inside it, and builds it first.
app.add_dependency(ext)
embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
build_file = embed.add_file_reference(ext.product_reference, true)
build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
# Keep it ahead of CocoaPods' scripts, which avoids Xcode's "dependency cycle" error.
pods_phase = app.build_phases.find { |p| p.respond_to?(:name) && p.name.to_s.include?("Embed Pods Frameworks") }
if pods_phase
  app.build_phases.delete(embed)
  app.build_phases.insert(app.build_phases.index(pods_phase), embed)
end

project.save
puts "lock screen timer added (#{bundle_id}.LiveActivity)"
