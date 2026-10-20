# Setup and technical notes

Everything needed to set up, deploy and maintain the app: Firebase, the test site, security, the data model and the iPhone build. The project overview is in the [README](../README.md).


Zero-build static PWA for tracking baby feeds, synced in real time between caregivers via Firebase.
No login — everyone in the same "household" shares a short code.

## One-time setup

### 1. Create a Firebase project
1. Go to https://console.firebase.google.com → **Add project** → name it anything (e.g. "baby-feed") → skip Google Analytics (not needed).
2. In the project, click the **web icon (`</>`)** to register a web app → name it "baby-feed" → **do not** check Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you and paste the values into [firebase-config.js](../firebase-config.js) in this repo (replace all the `REPLACE_ME` fields). These values are not secret — safe to commit.

### 2. Turn on Firestore
1. In the Firebase console, go to **Build → Firestore Database → Create database**.
2. Choose a region close to you, start in **production mode**.
3. Go to the **Rules** tab and replace the contents with the rules below, then **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{code}/{document=**} {
      allow read, write: if code is string && code.size() >= 4;
    }
  }
}
```

This means: anyone who knows the exact household code can read/write everything under that household (feeds, profile), and nothing else. There's no password beyond the code itself — don't share it outside the people feeding the baby. This is deliberately simple (no accounts/login), matching how the app is meant to be used.

> **If you set this up before the Profile feature was added**, your rules only cover `households/{code}/feeds/{feedId}` — go back to the Rules tab and replace them with the wildcard version above, then Publish, or saving a profile will fail.

### 3. Deploy to GitHub Pages
Already wired up for `github.com/2dezso/my-babys-feed` — see [Deploy](#deploy) below.


## Security (v107)

Each device signs in quietly with Firebase Anonymous sign-in (no email, no password) and registers itself under `households/{code}/members/{device id}`. The rules in `firestore.rules` then only let registered devices read or write that household. New household codes are 8 characters long (older 6-character codes keep working).

**Switching it on has to happen in this order, or the app stops loading:**

1. Firebase console, **Build, Authentication, Sign-in method**: turn on **Anonymous**.
2. Publish the app version that contains this section, and open the app once on each device you use (it registers itself).
3. Only then paste `firestore.rules` into **Firestore, Rules** and **Publish**. Before this step the old open rules are still in place, so nothing breaks.

To go back, paste the old rules from the section above into the Rules tab and publish.

What this does and does not do: strangers can no longer read or write a household without registering, and a household can now see which devices have joined. Registering still only needs the code, so the code is still the secret. Anyone who has the code can join.
## Local testing
Just open `index.html` in a browser — it's a static site, no build step, no server required (though some browsers restrict ES module imports over `file://`; if that happens, run any static file server, e.g. `npx serve` or use the deployed GitHub Pages URL).

## Adding payments later

Nothing in the app stops a purchase being added later. What is already in place, and what would be needed:

- **App Store Connect (your steps, no code):** accept the Paid Applications agreement and add bank and tax details (Business). Then create the product (for example a one-off "Plus" unlock) under the app's In-App Purchases and submit it with the next version. Join the App Store Small Business Program to pay Apple 15% instead of 30%.
- **The app:** it is a Capacitor app, so any StoreKit plugin works. Plugins are reached through `nativePlugin('Name')` in `app.js` (Capacitor's JavaScript package is not loaded, so `registerPlugin` does not exist), and a small Swift plugin can be added the same way the lock screen timer is (`scripts/ios-files/live/LiveFeedPlugin.swift`, registered in `MainViewController.swift`). The app already targets iOS 16.2, which is more than StoreKit 2 needs. In-app purchase needs no extra entitlement or capability setting for the build.
- **Where "this household has paid" lives:** in `households/{code}/entitlement/info`. `firestore.rules` lets members read it and lets no phone write it, so it cannot be faked by editing the app. A server (a Cloud Function, which needs the Blaze plan) checks Apple's receipt, or listens to RevenueCat, and writes it with the Admin SDK, which is not subject to the rules. One flag per household covers both parents' phones and the website.
- **Apple's rules to keep:** purchases of app features must use in-app purchase, there must be a "Restore purchases" button, and the app must not link to outside payment pages. The Terms already say paid extras may be offered in the future. Add the purchase data to the App Privacy answers and the privacy page when it is added.
- **Keep the core free:** logging, sharing and backup stay free, as the app's wording promises. Gate extras only, behind one check of the entitlement.

## Domain and email

The website lives at **littlesips.co.uk** (the `CNAME` file in the repo root names it; GitHub Pages serves it). DNS and email routing are on Cloudflare:

- Four `A` records for `@` to GitHub Pages (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153), set to DNS only (grey cloud) so GitHub can issue the certificate, and a `CNAME` for `www` to `2dezso.github.io`.
- `hello@littlesips.co.uk` is an Email Routing address that forwards to a private mailbox, so no personal address appears on the site.
- The old domain, charliesfirstyear.com, redirects to the new one with a Cloudflare redirect rule. The browser keeps its saved household code per web address, so anyone who used the old address joins again once with the code; nothing is lost on the server.
- The iPhone app does not use the web address at all (it carries its own copy of the files), so a domain change never affects it.

## Deploy
1. Bump the `?v=N` query string on any changed asset in `index.html` and `sw.js` (GitHub Pages caches aggressively).
2. `git add -A && git commit -m "..."`
3. `git push`
4. GitHub Pages rebuilds in ~30–60s at the repo's Pages URL.

Installed copies (Add to Home Screen) pick up a deploy the next time they're opened with a connection: the service worker fetches the page itself network-first and only falls back to its cached copy offline. The versioned CSS/JS/manifest are cache-first, which is safe because a new page references new `?v=N` URLs. On iOS, an app left open in the background may need swiping away and reopening to reload.

## Test version (try changes on your phone first)
A separate copy of the app at **https://2dezso.github.io/my-babys-feed-staging/**, hosted from its own repo (`2dezso/my-babys-feed-staging`). Nothing there touches the real site.

To put whatever is in this folder onto it, committed or not:

```
bash scripts/deploy-staging.sh
```

It takes about a minute to show up. The script copies only the app's web files (never `CNAME`, so it can't claim the real domain), then patches the copy so it can't be mistaken for the real one: an orange "TEST VERSION" bar across the top, the app name "Little Sips (TEST)", an orange icon, and `noindex` plus `robots.txt` so search engines skip it. It refuses to publish if any of those patches fail to apply.

**Data is separate because the household code is.** The test site shares Charlie's Firebase project, but a household is only ever the code you type, so a new code is a new empty household. On the phone, open the test URL, tap "Start a new household" and use that. Don't type the real household code into the test site: it would read and write Charlie's real feeds with code that hasn't been released yet.

Because the two sites are on different addresses, the phone treats them as different apps: separate stored household code, separate offline copy, and (with the orange icon) two icons on the home screen you can tell apart.

Going live is unchanged: the usual commit and `git push` to `master`. Publish to the test site first, try it, then push.

Limits: the test repo is public (as is this one); only top-level `.html`, `.js`, `.css` and `.json` files are copied, so assets added in a subfolder would need the script's copy line extended; and a fresh test household has no history, so Trends and the charts will be empty until you log some feeds.

## Summary look (v60)
The app was restyled in an iOS-health "Summary" look. Where the sections below describe the old look (pink/green gradients, emoji buttons, the scroll wheels, the floating 💬 button), this section wins.
- **Navigation**: a bottom tab bar (Today, Feeds, Nappies, Milestones, Trends) replaces the 🏠/💩 header buttons. The Today tab is the old home screen: one summary card per section, then a Household list (share code, add to home screen, profile, send feedback). The baby's initial in the top right opens Profile; the tab bar is hidden there.
- **Colour**: each section has its own colour (feeds green, nappies brown, milestones purple, trends red) set by `.s-feed` / `.s-nappy` / `.s-mile` / `.s-trend`, which define `--sec*` tokens everything inside uses. Girl in Profile turns the Feeds colour rose (`body.gender-pink`). Dark mode follows the phone.
- **Feeds hero**: big time since the last feed, a Next feed box ("in 41m" pill, or amber "Expected 12m ago", never "overdue") and a progress bar to the next feed.
- **Log a feed sheet** (one bottom sheet, three modes): amount is a ruler you drag (5ml steps, 10–300ml, starts at the last feed's amount; the hint says "Same as the last feed"). *Log past* asks "when" with 15m ago / 30m ago / 1h ago / Other time, and has no "Now": it won't save until a time is chosen. *Complete feed* (a started feed) and *Edit feed* show the feed's own time with a Change link. "Next feed in" has − / + 30 minute buttons; the clock time after "around" is worked out from the start time plus that gap, and the gap follows the amount until it is changed by hand (90ml→3h, +1h per 30ml, 2–6h). Edit also has "Delete this feed" (the ✕ on each row still works too).
- **Nappies**: the last-7-days dots became bars; the list shows the same Time / Size / Gap table.
- **Trends**: a hero with the longest overnight stretch last night and the last 14 nights as bars, then "Established" (two weeks running, or flat for three) and "Might be starting" (this week / last few days) cards. Only patterns `patterns.js` actually works out are shown: overnight stretch, usual feed times, milk per day, daytime gaps. Times are 24-hour.
- Elements are still looked up by the same ids; only the markup around them changed. The old amount/interval chips and wheels are gone (the bottle "Earlier" timer still uses a wheel).

- **Bottle**: Profile has a Bottle wheel of known brands (MAM, Dr. Brown's, Philips Avent, Tommee Tippee, NUK, Comotomo, Medela, Lansinoh, Chicco, Another brand). The choice is saved on the profile as `bottleBrand` and decides which drawing appears in the Feeds hero. Every brand points at the one MAM-style drawing for now; to give a brand its own, add a drawing to `BOTTLE_DESIGNS` in app.js and set that brand's `design`. The hero bottle is the short, soft MAM-style bottle with a cream collar and base.
- **One look (v83)**: every page shares one warm wash (`--wash-a` to `--wash-b` on `body`), one typeface (Nunito) and one set of warm neutrals. The four discs on Home use the same section colours as the pages they open (`--feed`, `--nappy`, `--mile`, `--trend`), so a disc and its page match.
- **Log a feed sheet (v85)**: the amount is one scroll wheel (10 to 300ml in 5ml steps, starting on the last feed's amount), like the live site but with a single wheel and a soft band marking the choice. *When* is Today / Yesterday / Other plus the phone's time field; for a new past feed the time starts empty and the button reads "Choose the time" until one is picked. *Next feed in* is a small minus / plus stepper in half hours that follows the amount until it is changed by hand. The quick amount chips, the second wheel and the "15m ago" buttons are gone.

## New household flow
Tapping "Start a new household" lands on the Profile screen in a welcome mode: a short intro line, "Save and continue" instead of "Save profile", and a "Skip for now" link. Either one goes to Baby Feed and shows the household code to share. Leaving Profile any other way just drops the welcome mode. Joining an existing household skips this, since the profile is already set up.

The Profile screen shows a live preview (avatar, full name as you type, age) above three cards: About (first/last name side by side, date of birth), Boy or girl (two large cards, each with a swatch of the colours it applies), and Icon (plain 👶 plus the four skin tones).

## Data model
Firestore: `households/{code}/feeds/{feedId}` → `{ type, timestamp, amountMl?, intervalHours }`
- `type`: always `bottle`
- `timestamp`: feed time in ms (client-editable via the time field, defaults to now)
- `amountMl`: bottle amount, picked via quick chips (60/90/120ml) or the scroll wheel (10ml, then 5ml steps to 120ml, then 10ml steps to 300ml) in the "Log a feed" modal. **Absent** for a feed started via "Start feed" and not yet finished — that's what marks it as pending (not `0`, since the wheel's minimum is 10ml)
- `intervalHours`: hours until the next expected feed, in half-hour increments. Auto-estimated from the amount (90ml→3h, +1h per +30ml, clamped 2–6h, always a whole hour) but can be overridden either with the quick chips (2h–6h) or the scroll wheel below them (1h–8h in 30-minute steps, same chips+wheel pattern as Amount). Sets the "Next feed" time in the hero card

A pending feed (no `amountMl`) turns the hero card into a "Feeding now" state (tap it to add the amount) and shows "Add amount" in its Past Feeds row instead of a value. The hero shows a single "Feeding now" timer while a feed is pending, since the next feed time depends on the amount.

The hero card is split in two halves: **Last feed** ("2h 14m" / "ago · 120ml") gets the wider column and the biggest number, since how long ago he fed matters most; **Next feed** ("16:40" / "in 46m", from the last feed's `intervalHours`) is smaller. Times use the same two-digit `formatClock()` as the rest of the app. Under them, a line runs from the last feed (left dot, its time underneath) to the next one (ringed dot, its time underneath), filled up to a "now" marker. Once the expected time passes, the right half's label becomes "Expected", its sub-line becomes an amber "12m ago" tag, and the line is rescaled to run from the last feed to now: the stretch past the expected dot is drawn in amber (`--amber`). Deliberately never "overdue" — a feed running later than expected isn't a problem. Below the hero, one card shows today's total ml and feed count (since midnight) next to the average gap between feeds over the last 24 hours. The header shows today's date under the title.

Every card on this screen (hero, day stats, bottle row, buttons, Past feeds table) shares one corner radius (`--radius`) and 14px spacing, so the hero's colour is the only thing that sets one apart.

**"Start feed"** and **"Log past"** are two separate pill buttons in `.feed-action-row`. Start feed is the larger, solid green one: the one-tap way to log a pending feed (`startFeed()`), no modal, just the current time, filling in the amount later. Log past is the lighter button and opens the modal for a fully-specified feed (own time/amount/interval).

While a feed is pending, "Log past" disappears and the Start feed button relabels itself **"Complete feed"**, taking the full width. Its click handler branches on whether a feed is pending: pending → opens the log modal in "Add amount" mode (same as tapping the hero card); not pending → starts a new one. This stops a second pending feed being started by accident mid-feed. "Past feeds" has four tabs: **1D** (rolling 24 hours, default), **7D** (rolling 7 days), **14D** and **All**. The sync query pulls up to the most recent 3000 feeds (roughly a year at typical feeding frequency) so the history tabs and the Trends chart have enough to work with. Entries are grouped by calendar day with a header showing that day's total ml.

1D, 7D and 14D (rolling 14 days) are just the list. All adds a bar chart above it (inline SVG built in `renderHistoryChart()`, coloured from the theme tokens so it follows the pink and dark themes):
- **All**: a By day / By week toggle (By week default). By day is one bar per day since the first feed, scrolling sideways. By week is one bar per Monday-starting week showing that week's **total ml**. A dashed line marks the average across complete weeks (the current week, and a first week that started before the first logged feed, are left out of that average so they don't drag it down while they're still only partly full) — the same pattern the By day view uses for its daily average.
- Tapping a bar selects it and the list underneath shows only that day or week. It opens on the latest bar that has feeds.
- Three numbers under the chart: average per day (across all complete days, regardless of which view is open), the change from the first complete week to the latest, and feeds logged.
- The chart's vertical scale rounds up to a "nice" step (200/500/1000/2000ml) based on the largest value showing, so daily and weekly views each get readable gridlines instead of one sharing the other's scale.
- Pending feeds (no amount yet) are left out of the chart totals but still appear in the list.

Tapping anywhere on a feed row (other than the ✕) opens the same log modal in edit mode — pre-filled with that feed's time and amount — so you can correct either one, reusing `finishFeed()`. Tapping the ✕ opens a confirm modal ("Delete this feed? This can't be undone.") rather than deleting immediately — the confirm button uses the `.btn-danger` style (red, matching `--danger`) to visually signal it's destructive.

Firestore: `households/{code}/profile/info` → `{ firstName, lastName, dob, avatarTone, gender }`
- `firstName`/`lastName`: separate fields in Profile, but only `firstName` is ever shown in the app (Profile tile label, Trends legend, and the "X's First Year" title on both the Baby Feed header and home screen) — `lastName` is captured for the record but has no display surface yet. Falls back to the older `name` field (pre-split households) if `firstName` is unset, so nothing breaks for existing data — there's no migration step, the fallback is permanent
- `dob`: date of birth as a `YYYY-MM-DD` string. Drives the "X months/weeks old" age line shown under it in Profile, and is the age-zero point for the Trends chart
- `avatarTone`: empty (plain 👶) or one of the four skin-tone emoji modifiers (🏻/🏽/🏾/🏿), applied to the 👶 icon on the Profile tile and the Profile screen itself
- `gender`: `male`, `female`, or unset, via the Boy/Girl cards (tap again to clear). `female` swaps the Baby Feed screen (`#app-screen`) to a pink/white palette (`body.gender-pink #app-screen` in style.css) along with the three modals opened from that screen (Log/Edit feed, confirm delete, bottle adjust) — everywhere else (Home, Poo, Milestones, Trends, the feedback modal) keeps its own fixed theme regardless of gender. `male` or unset keeps the default green scheme

Firestore: `households/{code}/poos/{pooId}` → `{ timestamp, size?, note? }`
- Nappy/poo log, reached via the 💩 icon next to the home button on the Baby Feed screen (its own light-brown themed page, separate from the home hub)
- `size`: optional, one of `Small`/`Medium`/`Big` via quick-tap chips (tap again to clear)
- `note`: optional free-text note
- "Log poo" opens a small modal (time defaults to now, but the date/time can be changed for backfilling) with the size chips and note field. Already covered by the wildcard Firestore rule above — no rules change needed for this one.
- The screen mirrors Baby Feed: date under the title, a hero with just the time since the last poo, then a Today card (poos since midnight, average gap over the last 7 days). Past has the same 1D/7D tabs and day-group headers (showing that day's poo count). Rows show time, size as a small tag, and gap, with any note on its own line underneath.
- A "Last 7 days" card sits between Today and the Log poo button: one column per day (rolling, ending today) with a dot per poo, capped at 5 dots plus a "+N" label. A day with none shows a dashed ring, and a note underneath names those days ("No poo on Thursday"). Today is excluded from that note, since the day isn't over.
- Tapping anywhere on a poo row (other than the ✕) opens the same modal in edit mode — pre-filled with that entry's time, size, and note — mirroring how feed rows are editable. Clearing a previously-set size or note on save actually removes that field via `deleteField()` rather than leaving a stale value behind, since `updateDoc` (unlike a fresh `addDoc`) merges into the existing document instead of replacing it.

Firestore: `households/{code}/bottle/info` → `{ madeAt }`
- Single shared doc (not a log) — tapping the main "Bottle made" pill sets `madeAt` to now, synced live to every caregiver's device
- While a timer is running, an ✕ button next to the 🕐 clears it (sets `madeAt` back to `null`)
- The pill counts down from a 2-hour "good for" window and turns red with "Expired — discard" once time's up
- Tapping the main pill at any time (even mid-countdown) restarts the timer from now — tapping the pill always means "I just made a bottle"
- A small 🕐 button on the pill's edge opens a "When was it made?" scroll wheel (0–120 minutes ago, 5-minute steps) for when you forget to tap it right away — same `startBottleTimer()` path, just backdated. The main pill tap is untouched and still instant ("just made it now", no modal) — the wheel only replaces the old four-chip picker behind the 🕐 button

The pill is now a `<div>` wrapping two separate `<button>`s (main tap area + the 🕐 adjust button) rather than being one button itself, since a `<button>` can't contain another interactive control.

## Picking a past date
The feed and poo modals share one "When" control: **Today** and **Yesterday** buttons, then a visible date field and time field. The date field used to be an invisible input laid over a text label, which some Android browsers would not open reliably; it is now a normal, visible `<input type="date">`, with the two buttons as a one-tap fallback for the common case. The date input has `max` set to today, so future days cannot be picked.

If a logged entry is older than the Past feeds / Past tab being viewed (1D by default), the list switches to the first tab wide enough to include it, so a backdated entry does not appear to vanish.

## Feedback
A bouncing 💬 button floats in the bottom-right corner of the home screen only, for now. Tapping it opens a small modal with an Idea/Problem toggle and a message box.

Firestore: `households/{code}/feedback/{feedbackId}` → `{ type, message, timestamp }`
- `type`: `idea` or `problem`, picked via the two chips (defaults to `idea`)
- `message`: free-text
- Already covered by the wildcard Firestore rule above — no rules change needed for this one
- There's no in-app viewer for this by design — read it straight from the **Firebase Console** (Firestore Database → `households` → your code → `feedback`), since it's just you checking in occasionally rather than something worth building a dedicated screen for

## Add to Home Screen
A "📲 Add to Home Screen" button on the home screen, shown only when relevant:
- **Android/Chrome**: hidden until the browser fires `beforeinstallprompt` (the standard signal a PWA is installable), at which point tapping the button calls `.prompt()` for a real native install dialog — no custom UI needed, the OS handles it
- **iOS Safari**: `beforeinstallprompt` doesn't exist on iOS at all — Apple gives no programmatic way to trigger "Add to Home Screen". Detected via user agent (`iPad|iPhone|iPod`, plus the iPadOS-reports-as-Mac case via `navigator.platform === 'MacIntel' && maxTouchPoints > 1`) and shown unconditionally for those devices, since there's no installability signal to wait for. Tapping it opens an instructional modal ("Tap Share, then Add to Home Screen") since that's the only path Safari allows
- Hidden entirely once already installed, checked via `display-mode: standalone` (Android/desktop) or the iOS-only `navigator.standalone` property, and re-hidden immediately on the `appinstalled` event after a successful Android install

## Trends & Facts
The Trends page reads the feed log and describes it. Nothing on it compares your baby with an average or a target, and there is no reference line (an older version had reference charts; they were removed).

- A hero card answers one question: how long was the longest stretch last night, with the last two weeks of nights as bars.
- Cards for Overnight stretch, Usual feed times, Milk per day and Daytime gaps. `analyse()` in `patterns.js` finds the patterns and `app.js` draws them. A pattern only counts as established once two weeks agree; until then its card is marked as tentative.
- A "Fun fact of the week" picks one line from `FUN_BABY_FACTS` in `app.js` by week. The list is deliberately harmless trivia: nothing about health, weight, sleep needs, safety or normal ranges, because App Review looks harder at health information. Add to it only in that spirit.
- A small note under the page says the patterns are not medical advice.

## Deleting a household
Settings, Your data, "Delete this household" (`deleteHousehold()` in `app.js`). It shows counts from the server (which also proves there is a connection), offers a backup, asks for the word DELETE, then deletes in batches of 400 in this order: feeds, poos, milestones, feedback, profile, bottle, the other devices' `members` documents, a `tombstone/info` marker (`{ deletedAt }`), and finally this device's own `members` document. The order matters because the rules need the device to still be a member while it deletes. Each step can be repeated, so a dropped connection is fixed by pressing Try again.

The `tombstone` document is the only thing left. `firestore.rules` lets any signed-in device read it. Phones that still hold the deleted code check it on open (`joinUnlessDeleted()`), forget the code and show a notice, and joining a deleted code says so. No new rule is needed for the deletes themselves. **The rules file changed for this, so republish it with the rest of the security rollout.**

## Milestones
The Milestones screen (its own lavender-themed page) is a month calendar, styled after Instagram's Stories Archive — one entry per day, days with an entry show a thumbnail circle, tap any day to add/edit/delete it.

Firestore: `households/{code}/milestones/{dateKey}` → `{ photoDataUrl?, caption?, updatedAt }`
- `dateKey` is the date itself as `YYYY-MM-DD`, so there's exactly one document per day
- `photoDataUrl`: optional, a compressed photo stored **inline in Firestore** as a base64 JPEG data URI (resized client-side to a max 1000px edge, ~70% quality — typically 100–300KB). This was a deliberate choice over Firebase Storage: Storage now requires the project to be on the Blaze (pay-as-you-go) plan even to stay within its free quota, while Firestore works entirely on the free Spark plan already in use. A full year of daily photos this way runs well under Firestore's 1GB free storage. If photo quality ever becomes limiting, swapping to Storage later only means changing where this field's value comes from, not a redesign
- `caption`: optional free-text note
- The calendar only fetches the currently-viewed month's milestones (a Firestore range query on the document ID), not the whole collection at once, so browsing doesn't pull a year of photos into memory just to show one month
- Bounded to the baby's first year (birth month → +11 months) when a date of birth is set in Profile; otherwise defaults to the current month with unbounded navigation

## Costs
Firebase Spark (free) plan covers this comfortably — Firestore free tier is 50K reads / 20K writes per day, far beyond what a feeding tracker for one baby will use. GitHub Pages hosting is free.

## iPhone app (Capacitor)

The iPhone app is this same website wrapped in a native shell (Capacitor). The wrapper only adds what a website cannot do, which today is the **next feed reminder** (a local notification set on the phone). Everything else, including the data in Firebase, is unchanged. Inside the app the reminder setting appears in Profile; in a normal browser it is hidden.

Files: `package.json`, `capacitor.config.json` (app id `com.charliesfirstyear.app`, which cannot be changed once the app is in App Store Connect), `scripts/build-www.sh` (copies the site into `www/`).

Building needs macOS with Xcode (a Mac, or a cloud Mac such as a GitHub Actions macOS runner), then:

```
npm install
npx cap add ios        # once
npm run sync           # after any change to the website files
npx cap open ios       # opens Xcode: set the team, then Product > Archive
```

Reminder behaviour: one notification (id 1) is scheduled for the expected next feed time minus the chosen lead (On time, 10 or 30 minutes before). It is replaced whenever the feeds change and cancelled while a feed is running. The setting is kept per device in `localStorage` (`babyfeed_reminder_lead`).

## Working offline (v123)

Firebase (`vendor/firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`, version 10.14.1) and the Nunito font (`fonts/`) are saved inside the project, not loaded from the internet, so the app opens with no signal. The service worker keeps them with the rest of the app, and `scripts/build-www.sh` and `scripts/deploy-staging.sh` copy both folders.

- The three Firebase files must keep identical addresses: `app.js` imports `./vendor/firebase-app.js` and the other two import `./firebase-app.js`, which resolve to the same file. Adding a `?v=` to one of them would load Firebase twice and break it.
- To update Firebase, download the same three files for the new version from `https://www.gstatic.com/firebasejs/<version>/`, and replace `https://www.gstatic.com/firebasejs/<version>/firebase-app.js` inside the auth and firestore files with `./firebase-app.js`.
- Data written with no signal is kept on the phone by Firestore and sent when the connection returns.

## Reading feeds cheaply (v125)

Google charges per document read, so the app does not read every feed each time it opens. `listenToFeeds` follows only the last 28 days (`FEED_WINDOW_DAYS`), plus the single most recent older feed so "Last feed" is right after a long break. Older feeds are read, live, only when the Past feeds "All" tab is opened (`ensureOlderFeeds`). The Profile totals use Google-side `count` and `sum` queries (`refreshProfileCounts`), and Trends gets the date of the first feed from one small read (`lookupOldestFeed`). Nothing stored changes. Trends needs at most 21 days (three weekly windows in `patterns.js`), so 28 days leaves room.

The poo list follows the same 28 days, is read only when the Poos page is first opened, (plus the single most recent older poo), and the Settings page shows a "Free to use" card and a "Plus, coming soon" note. The note is hidden for now (`SHOW_PLUS_TEASER` near the end of `app.js`; set it to `true` to show it, priced at 2.99 pounds one-off). The "Rate the app" button needs `APP_STORE_REVIEW_URL` filling in once the app is published.

## iPhone app: cloud build

The iPhone app is built on a GitHub cloud Mac by `.github/workflows/ios.yml`, which runs only when started by hand (GitHub, Actions tab, "iPhone build", Run workflow). It makes the Xcode project fresh each time with `scripts/ios-prepare.sh` (website files, icon from `icon-1024.png`, home-screen name "Little Sips"), signs it using an App Store Connect API key, and sends it to App Store Connect, where it shows up in TestFlight after Apple's processing (usually 10 to 30 minutes).

One-time setup, after the Apple Developer account is approved:

1. **Apple Developer, Identifiers:** register the app ID `com.charliesfirstyear.app` (the same as `capacitor.config.json`). Tick Push Notifications only if remote notifications are added later; local reminders need nothing.
2. **App Store Connect, Apps:** create the app with that bundle ID, name and primary language.
3. **App Store Connect, Users and Access, Integrations, App Store Connect API:** create a key with the **Admin** role (needed so the build can create its own signing certificate and profile). Download the `.p8` file once, and note the Key ID and Issuer ID.
4. **Apple Developer, Membership:** note the 10-character Team ID.
5. **GitHub, this repo, Settings, Secrets and variables, Actions:** add `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_P8` (paste the whole contents of the `.p8` file).
6. Run the workflow. Each run uses the GitHub run number as the build number and `package.json`'s version as the app version.

If the Firebase browser key is restricted to certain websites, add the app's own address (`capacitor://localhost`) so the iPhone app can reach the database.

This workflow has not been run yet; the first run may need small fixes, and failures keep their logs as a downloadable artifact.
