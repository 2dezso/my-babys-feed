#!/usr/bin/env bash
# Publishes whatever is in this folder right now (committed or not) to the test site,
# so it can be tried on a phone before anything goes to the real site.
#
#   bash scripts/deploy-staging.sh
#
# The test site is a separate GitHub repo with its own Pages URL. The copy is
# patched so it can't be mistaken for the real one: orange "TEST" bar, "(TEST)"
# app name, orange icon, and noindex so search engines skip it.
set -euo pipefail

REPO="2dezso/my-babys-feed-staging"
URL="https://2dezso.github.io/my-babys-feed-staging/"

cd "$(git rev-parse --show-toplevel)"
SRC_REV="$(git rev-parse --short HEAD)"
DIRTY=""
git diff --quiet HEAD -- . ':!scripts' 2>/dev/null || DIRTY=" + uncommitted changes"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# App files only: top-level web files. Never CNAME (would claim the real domain),
# README, prototypes, or tooling folders.
for f in *.html *.js *.css *.json; do
  [ -f "$f" ] && cp "$f" "$tmp/$f"
done

cd "$tmp"

# Orange name, icon and title so the test app is obvious next to the real one.
sed -i "s/\"name\": \"Charlie's First Year\"/\"name\": \"Charlie's Year (TEST)\"/" manifest.json
sed -i "s/\"short_name\": \"Charlie's Year\"/\"short_name\": \"Year TEST\"/" manifest.json
sed -i "s/%234c9a4e/%23e08a2b/g" manifest.json
sed -i 's|<title>\(.*\)</title>|<title>TEST - \1</title>\n<meta name="robots" content="noindex, nofollow">|' index.html
sed -i 's|^<body>|<body>\n<div style="background:#e08a2b;color:#fff;font:700 12px/24px sans-serif;text-align:center;letter-spacing:.04em">TEST VERSION · use a test household, not the real code</div>|' index.html
printf 'User-agent: *\nDisallow: /\n' > robots.txt

# Safety net: the patches above must have applied, or the copy could pass for the real app.
grep -q "(TEST)" manifest.json || { echo "manifest patch failed, not publishing"; exit 1; }
grep -q "TEST VERSION" index.html || { echo "banner patch failed, not publishing"; exit 1; }
grep -q 'noindex' index.html || { echo "noindex patch failed, not publishing"; exit 1; }

git init -q -b main
git add -A
git -c user.name="Test build" -c user.email="test@example.invalid" \
  commit -q -m "Test build of ${SRC_REV}${DIRTY} ($(date '+%Y-%m-%d %H:%M'))"
git remote add origin "https://github.com/${REPO}.git"
git push -q --force origin main

echo
echo "Published ${SRC_REV}${DIRTY} to the test site."
echo "Open on your phone: ${URL}"
echo "(GitHub takes about a minute to refresh it.)"
