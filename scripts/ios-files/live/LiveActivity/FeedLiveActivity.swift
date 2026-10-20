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

// A timer that counts up by itself. Every piece of text that could be wider than its box (a long name, a feed that has run
// past an hour, a larger text size) is set to one line and shrinks to fit, so nothing is cut off or runs out of the card.
private struct ElapsedTimer: View {
    let since: Date
    let size: CGFloat

    var body: some View {
        Text(since, style: .timer)
            .font(.system(size: size, weight: .bold, design: .rounded))
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .multilineTextAlignment(.trailing)
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
                .frame(width: 112, alignment: .trailing)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
