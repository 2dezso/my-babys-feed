# Siri phrases (saved for a later release)

Built and tested, then switched off for the first App Store version. Nothing in this folder is copied into the iPhone
build until it is put back as below. The same code is also saved in the git tag `siri-ready` (commit before it was
taken out), so `git show siri-ready:scripts/ios-files/live/SiriShortcuts.swift` always works.

What it does: "Hey Siri, start a feed in Little sips", "finish a feed in Little sips" and "bottle made in Little sips"
(the app's name has to be part of the phrase, which is Apple's rule). The phrase opens the app and leaves a note; the web
app picks the note up within a second and does what a tap would do, so the feed is saved with its own sign-in.

Files here
- `SiriShortcuts.swift`: the three App Intents and the phrases (an `AppShortcutsProvider`).
- `SiriCommandPlugin.swift`: the plugin the web app calls (`takeCommand`) to collect the note.

To turn it back on
1. Copy both Swift files to `scripts/ios-files/live/`.
2. In `scripts/ios-live-activity.rb`, add `SiriShortcuts.swift SiriCommandPlugin.swift` to the list of the app's own files.
3. In `scripts/ios-files/live/MainViewController.swift`, add `bridge?.registerPluginInstance(SiriCommandPlugin())`.
4. In `app.js`, set `SIRI_ENABLED = true`. (The Siri section in Settings, `#siri-card` in `index.html`, then appears in the app.)
5. Put the Siri section back in `help.html`, above "Using it without signal", wrapped in `<div class="native-only">`:

   > **Siri.** In the iPhone app you can use your voice. Say *Hey Siri, start a feed in Little sips*, *finish a feed in
   > Little sips* or *bottle made in Little sips*. The app opens and does it. The name of the app has to be part of what
   > you say, which is Apple's rule. The same actions are in the Shortcuts app, where you can put them on the Action
   > button or a button on your Home Screen.

6. Add a line about it to the App Store review notes, and run a build. The build log should say `Siri phrases: present`
   (add back the `Metadata.appintents` check in `.github/workflows/ios.yml`).

How it was tested: in a headless WebKit with a stand-in for the phone's note (start, start again while running, finish
with and without a running feed, bottle made, a note older than three minutes ignored). The build compiled and the
phrases were present in the app. It has not been tried on a real phone.
