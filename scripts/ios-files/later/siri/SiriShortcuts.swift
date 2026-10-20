import AppIntents
import Foundation

// "Hey Siri" and Shortcuts. Each phrase has to include the app's name, so people say "start a feed in Little sips".
// A phrase opens the app (the feed is saved by the web app, which has the sign-in and the household) and leaves a note
// that the web app picks up as soon as it is open. See SiriCommandPlugin.swift.

let littleSipsPendingCommandKey = "littleSipsPendingCommand"

func leavePendingCommand(_ command: String) {
    UserDefaults.standard.set(
        ["command": command, "at": Date().timeIntervalSince1970 * 1000],
        forKey: littleSipsPendingCommandKey
    )
}

struct StartFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Start a feed"
    static let description = IntentDescription("Starts a feed and its timer in Little sips.")
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        leavePendingCommand("start-feed")
        return .result()
    }
}

struct FinishFeedIntent: AppIntent {
    static let title: LocalizedStringResource = "Finish a feed"
    static let description = IntentDescription("Opens the running feed in Little sips, ready to add how much was drunk.")
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        leavePendingCommand("finish-feed")
        return .result()
    }
}

struct BottleMadeIntent: AppIntent {
    static let title: LocalizedStringResource = "Bottle made"
    static let description = IntentDescription("Starts the bottle timer in Little sips.")
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        leavePendingCommand("bottle-made")
        return .result()
    }
}

struct LittleSipsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartFeedIntent(),
            phrases: [
                "Start a feed in \(.applicationName)",
                "Start feed in \(.applicationName)",
                "Start a feed with \(.applicationName)",
            ],
            shortTitle: "Start feed",
            systemImageName: "heart.fill"
        )
        AppShortcut(
            intent: FinishFeedIntent(),
            phrases: [
                "Finish a feed in \(.applicationName)",
                "Finish the feed in \(.applicationName)",
            ],
            shortTitle: "Finish feed",
            systemImageName: "checkmark.circle.fill"
        )
        AppShortcut(
            intent: BottleMadeIntent(),
            phrases: [
                "Bottle made in \(.applicationName)",
                "I made a bottle in \(.applicationName)",
            ],
            shortTitle: "Bottle made",
            systemImageName: "timer"
        )
    }
}
