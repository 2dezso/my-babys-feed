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
    match /households/{code}/feeds/{feedId} {
      allow read, write: if code is string && code.size() >= 4;
    }
  }
}
```

This means: anyone who knows the exact household code can read/write that household's feeds, and nothing else. There's no password beyond the code itself — don't share it outside the people feeding the baby. This is deliberately simple (no accounts/login), matching how the app is meant to be used.

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
- `timestamp`: feed time in ms (client-editable via the time picker, defaults to now)
- `amountMl`: optional bottle amount
- `intervalHours`: how many hours until the next expected feed (chosen at log time, defaults to 3), used to compute "Next feed expected" on the home screen

## Costs
Firebase Spark (free) plan covers this comfortably — Firestore free tier is 50K reads / 20K writes per day, far beyond what a feeding tracker for one baby will use. GitHub Pages hosting is free.
