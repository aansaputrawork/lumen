#!/usr/bin/env python3
"""Rebuilds preview.html (single file: login + app, in-memory demo data, no server needed).
Usage:  python3 scripts/build-preview.py
Sources: index.html (script order), the CSS/JS files in the project root, and scripts/preview/* (demo photos, demo video, fake Supabase)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
rd = lambda p: (root / p).read_text(encoding="utf-8")
idx = rd("index.html")
css = "".join(rd(m) + "\n" for m in re.findall(r'<link rel="stylesheet" href="((?!http)[^"]+\.css)"', idx))
local = [m for m in re.findall(r'<script src="([^"]+)"', idx) if not m.startswith("http") and m != "config.js"]
js = "".join(f"<script>\n{rd(f)}\n</script>\n" for f in local)
pv = lambda n: rd("scripts/preview/" + n)
html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>MIKA Photos — Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<style>
{css}</style>
<meta name="theme-color" content="#0C0A0B">
</head><body><div id="app"></div>
<!-- PREVIEW: single file, no server. Sign in with any email/password. Data lives in memory only (lost on refresh). The real code is in the project files. -->
<script>
window.LUMEN_CONFIG={{SUPABASE_URL:"https://preview.local",SUPABASE_ANON_KEY:"preview",FUNCTIONS_URL:"https://preview.local/fn"}};
</script>
<script>
{pv("images.js")}{pv("video.js")}</script>
<script>
{pv("stub.js")}</script>
{js}</body></html>
"""
(root / "preview.html").write_text(html, encoding="utf-8")
print("preview.html", round(len(html) / 1024), "KB; scripts:", ", ".join(local))
