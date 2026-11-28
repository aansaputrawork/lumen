// Capacitor 8 native plugin bridge. This file is bundled into www/media-bridge.js by build-www.sh.
import { Media } from "@capacitor-community/media";
import { Filesystem } from "@capacitor/filesystem";
window.MikaPlugins = Object.assign(window.MikaPlugins || {}, { Media, Filesystem });
