import ActivityKit
import Capacitor
import Foundation

// Lets the web app start and end the lock screen timer for a running feed. Registered by MainViewController.
@objc(LiveFeedPlugin)
public class LiveFeedPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveFeedPlugin"
    public let jsName = "LiveFeed"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false, "reason": "switched off in Settings"])
            return
        }
        let name = call.getString("name") ?? ""
        let startedMs = call.getDouble("startedAt") ?? (Date().timeIntervalSince1970 * 1000)
        Task {
            // One timer at a time: clear any left from an earlier run first.
            for activity in Activity<FeedActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            let attributes = FeedActivityAttributes(babyName: name, startedAt: Date(timeIntervalSince1970: startedMs / 1000))
            // After 45 minutes the lock screen says to open the app, in case the feed was finished on another phone.
            let content = ActivityContent(
                state: FeedActivityAttributes.ContentState(running: true),
                staleDate: Date().addingTimeInterval(45 * 60)
            )
            do {
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false, "reason": "\(error.localizedDescription)"])
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        Task {
            for activity in Activity<FeedActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
