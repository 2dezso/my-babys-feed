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
Firestore: `households/{code}/feeds/{feedId}` → `{ type, timestamp, amountMl, intervalHours }`
- `type`: always `bottle`
- `timestamp`: feed time in ms (client-editable via the time field, defaults to now)
- `amountMl`: bottle amount, picked via quick chips (60/90/120ml) or the scroll wheel
- `intervalHours`: hours until the next expected feed. Auto-estimated from the amount (90ml→3h, +1h per +30ml, clamped 2–6h) but can be overridden with the interval chips. Used to compute "Next feed expected" on the home screen

The home screen also shows time-since-last-feed live, and the total ml fed since midnight. "Past feeds" filters to calendar-day ranges (today, or the last 7/30 calendar days, each starting at 00:00) rather than a rolling 24h window (the sync query pulls up to the most recent 500 feeds to keep the 30-day view populated).

Firestore: `households/{code}/profile/info` → `{ name, dob }`
- `name`: baby's name, also shown as the Profile tile's label on the home screen
- `dob`: date of birth as a `YYYY-MM-DD` string (not currently used elsewhere yet — reserved for future age-aware features)

## Costs
Firebase Spark (free) plan covers this comfortably — Firestore free tier is 50K reads / 20K writes per day, far beyond what a feeding tracker for one baby will use. GitHub Pages hosting is free.
