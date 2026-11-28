#!/bin/sh
set -eu
# Build web assets. Prefer the project's locally installed esbuild; use the
# already bundled offline bridge when esbuild is not installed.
rm -rf www
mkdir -p www
cp -r index.html *.js *.css manifest.webmanifest icons assets www/
rm -f www/preview.html www/admin.html
if [ -x node_modules/.bin/esbuild ]; then
  node_modules/.bin/esbuild scripts/media-bridge.js --bundle --format=iife --platform=browser --outfile=www/media-bridge.js
else
  cp scripts/media-bridge.bundle.js www/media-bridge.js
fi
