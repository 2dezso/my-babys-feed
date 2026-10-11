#!/usr/bin/env bash
# Copies the website files into www/, which is the folder the iPhone app is built from.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
rm -rf www && mkdir www
for f in *.html *.js *.css *.json; do
  case "$f" in package.json|package-lock.json|capacitor.config.json) continue ;; esac
  [ -f "$f" ] && cp "$f" "www/$f"
done
echo "www/ ready: $(ls www | wc -l) files"
