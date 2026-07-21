#!/usr/bin/env bash
# Compiles the design-system stylesheet for the claude.ai/design sync.
# Tailwind v4 CLI compiles globals.css (the av-* system + tokens) with the
# app source as content, then web-font imports + next/font var shims are
# stitched in (the app injects --font-inter/--font-geist-mono via next/font,
# which doesn't exist outside the app).
set -e
cd "$(dirname "$0")/../nextjs-project"
mkdir -p .ds-css
npx --yes @tailwindcss/cli@4 -i src/app/globals.css -o .ds-css/tw.css
{
  echo '@import url("https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Geist+Mono:wght@400..700&display=swap");'
  cat .ds-css/tw.css
  echo ':root { --font-inter: "Inter"; --font-geist-mono: "Geist Mono"; }'
} > .ds-css/acmi.css
echo "wrote nextjs-project/.ds-css/acmi.css ($(wc -c < .ds-css/acmi.css) bytes)"
