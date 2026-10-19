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
                        .font(.title2)
                        .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(feedTitle(for: context.attributes))
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startedAt, style: .timer)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 100, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Open Little Sips to finish the feed")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "heart.fill")
                    .foregroundStyle(.white)
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .monospacedDigit()
                    .frame(maxWidth: 56)
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
                Text(context.isStale ? "Open Little Sips to check" : "Feeding now")
                    .font(.subheadline)
                    .opacity(0.85)
            }
            Spacer(minLength: 8)
            Text(context.attributes.startedAt, style: .timer)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 130, alignment: .trailing)
        }
        .foregroundStyle(.white)
        .padding(16)
    }
}
