# Baby Feed

Zero-build static PWA for tracking baby feeds, synced in real time between caregivers via Firebase.
No login — everyone in the same "household" shares a short code.

## One-time setup

### 1. Create a Firebase project
1. Go to https://console.firebase.google.com → **Add project** → name it anything (e.g. "baby-feed") → skip Google Analytics (not needed).
2. In the project, click the **web icon (`</>`)** to register a web app → name it "baby-feed" → **do not** check Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you and paste the values into [firebase-config.js](firebase-config.js) in this repo (replace all the `REPLACE_ME` fields). These values are not secret — safe to commit.

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

## Local testing
Just open `index.html` in a browser — it's a static site, no build step, no server required (though some browsers restrict ES module imports over `file://`; if that happens, run any static file server, e.g. `npx serve` or use the deployed GitHub Pages URL).

## Deploy
1. Bump the `?v=N` query string on any changed asset in `index.html` and `sw.js` (GitHub Pages caches aggressively).
2. `git add -A && git commit -m "..."`
3. `git push`
4. GitHub Pages rebuilds in ~30–60s at the repo's Pages URL.

## Data model
Firestore: `households/{code}/feeds/{feedId}` → `{ type, timestamp, amountMl?, intervalHours }`
- `type`: always `bottle`
- `timestamp`: feed time in ms (client-editable via the time field, defaults to now)
- `amountMl`: bottle amount, picked via quick chips (60/90/120ml) or the scroll wheel. **Absent** while a feed is logged via "Start feed — add amount later" and hasn't been finished yet — that's what marks it as pending (not `0`, since the wheel's minimum is 20ml)
- `intervalHours`: hours until the next expected feed. Auto-estimated from the amount (90ml→3h, +1h per +30ml, clamped 2–6h) but can be overridden with the interval chips. Used to compute "Next feed expected" on the home screen

A pending feed (no `amountMl`) turns the home screen's hero card into a "Feeding now" state (tap it to add the amount) and shows "Add amount" in its Past Feeds row instead of a value.

The home screen also shows time-since-last-feed live, and the total ml fed since midnight. "Past feeds" has three tabs: **Today** (calendar day, midnight to now), **1D** (rolling 24 hours), **7D** (rolling 7 days) — the sync query pulls up to the most recent 3000 feeds (roughly a year at typical feeding frequency) so both the history tabs and the Trends chart have enough to work with. Entries are grouped by calendar day with a header showing that day's total ml, so multi-day ranges (7D) show a running breakdown per day, not just one combined list.

Firestore: `households/{code}/profile/info` → `{ name, dob, avatarTone }`
- `name`: baby's name, also shown as the Profile tile's label on the home screen and as the Trends chart's legend/summary label
- `dob`: date of birth as a `YYYY-MM-DD` string. Drives the "X months/weeks old" age line shown under it in Profile, and is the age-zero point for the Trends chart
- `avatarTone`: one of the four 👶 skin-tone emoji modifiers (🏻/🏽/🏾/🏿), applied to the 👶 icon on the Profile tile and the Profile screen itself

Firestore: `households/{code}/poos/{pooId}` → `{ timestamp, size?, note? }`
- Nappy/poo log, reached via the 💩 icon next to the home button on the Baby Feed screen (its own light-brown themed page, separate from the home hub)
- `size`: optional, one of `Small`/`Medium`/`Big` via quick-tap chips (tap again to clear)
- `note`: optional free-text note
- "Log poo" opens a small modal (time defaults to now, but the date/time can be changed for backfilling) with the size chips and note field; same "since last" hero stat and Today/1D/7D history pattern as feeds, just without an amount column or day-total headers. Already covered by the wildcard Firestore rule above — no rules change needed for this one.

Firestore: `households/{code}/bottle/info` → `{ madeAt }`
- Single shared doc (not a log) — tapping the "Bottle made" pill on the Baby Feed screen sets `madeAt` to now, synced live to every caregiver's device
- The pill counts down from a 2-hour "good for" window and turns red with "Expired — discard" once time's up
- Tapping again at any time (even mid-countdown) restarts the timer from now — there's no separate reset/clear action, tapping always means "I just made a bottle"

## Trends & Facts
The Trends screen (its own peach-themed page) plots a line chart comparing:
- **World average**: a hardcoded reference curve of typical daily milk intake by age in weeks, built from commonly-published general feeding guidelines. This is **illustrative, not medical advice** — it's a static table in `app.js` (`WORLD_AVG_ML_BY_WEEK`), not a live data source (this is a static site with no backend beyond Firestore).
- **Your baby**: computed from actual feed data — feeds are bucketed by the baby's age in weeks (from Profile's date of birth) and averaged to a daily rate per week, so the line is a weekly average rather than noisy daily totals.

Requires a date of birth to be set in Profile; without one, only the reference line shows and a hint prompts you to add it.

## Costs

## Costs
Firebase Spark (free) plan covers this comfortably — Firestore free tier is 50K reads / 20K writes per day, far beyond what a feeding tracker for one baby will use. GitHub Pages hosting is free.
