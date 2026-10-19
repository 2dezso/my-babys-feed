import ActivityKit
import Foundation

// What the lock screen timer shows. Shared by the app (which starts and ends it) and the small extension that draws it.
// The timer counts up by itself from startedAt, so nothing has to update it while the feed runs.
struct FeedActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var running: Bool
    }

    var babyName: String
    var startedAt: Date
}
