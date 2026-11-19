#!/bin/sh
# Menyalin file web statis ke www/ untuk dibungkus Capacitor.
rm -rf www && mkdir -p www && cp -r index.html *.js *.css manifest.webmanifest icons assets www/ && rm -f www/preview.html www/admin.html
