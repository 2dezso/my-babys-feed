import ActivityKit
import SwiftUI
import WidgetKit

@main
struct LiveActivityBundle: WidgetBundle {
    var body: some Widget {
        FeedLiveActivity()
    }
}

private let sipsGreen = Color(red: 0.11, green: 0.48, blue: 0.26)

private func feedTitle(for attributes: FeedActivityAttributes) -> String {
    attributes.babyName.isEmpty ? "Feed in progress" : "\(attributes.babyName)\u{2019}s feed"
}

// The running time. Awake, it counts up by itself. When the screen is dimmed or idle, iOS stops updating timers every
// second and shows a rough time such as "12 minutes" instead, which updates by the minute; it counts again when the phone
// wakes. That words-style text is much wider than the digits, so the dimmed layout is smaller and may use two lines.
// Every piece of text that could be wider than its box (a long name, a feed past an hour, a larger text size) is also set
// to shrink to fit, so nothing runs out of the card.
private struct ElapsedTimer: View {
    let since: Date
    let size: CGFloat
    @Environment(\.isLuminanceReduced) private var dimmed

    var body: some View {
        if dimmed {
            Text(since, style: .relative)
                .font(.system(size: size * 0.55, weight: .semibold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .multilineTextAlignment(.trailing)
        } else {
            Text(since, style: .timer)
                .font(.system(size: size, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .multilineTextAlignment(.trailing)
        }
    }
}

struct FeedLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FeedActivityAttributes.self) { context in
            LockScreenFeedView(context: context)
                .activityBackgroundTint(sipsGreen)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "heart.fill")
                        .font(.title3)
                        .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(feedTitle(for: context.attributes))
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedTimer(since: context.attributes.startedAt, size: 22)
                        .frame(width: 84, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Open Little Sips to finish the feed")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            } compactLeading: {
                Image(systemName: "heart.fill")
                    .foregroundStyle(.white)
            } compactTrailing: {
                ElapsedTimer(since: context.attributes.startedAt, size: 13)
                    .frame(width: 46, alignment: .trailing)
            } minimal: {
                Image(systemName: "heart.fill")
                    .foregroundStyle(.white)
            }
        }
    }
}

struct LockScreenFeedView: View {
    let context: ActivityViewContext<FeedActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "heart.fill")
                .font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(feedTitle(for: context.attributes))
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(context.isStale ? "Open Little Sips to check" : "Feeding now")
                    .font(.subheadline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .opacity(0.85)
            }
            .layoutPriority(1)
            Spacer(minLength: 6)
            // A fixed width keeps the timer from claiming the whole row, which is what pushed the text out of the card.
            ElapsedTimer(since: context.attributes.startedAt, size: 30)
                .frame(width: 124, alignment: .trailing)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
