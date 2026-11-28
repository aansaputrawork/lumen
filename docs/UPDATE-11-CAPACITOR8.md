# MIKA update 11 — Google Drive, download, and UI/UX

- Fixed Google Drive-only media download so it uses the authenticated `import_download` endpoint and the Drive connection ID.
- Fixed Google Drive Albums preview lookup so tapping a Drive photo resolves the matching media item.
- Share now prefers sharing the actual photo/video file when the platform supports file sharing; link sharing is only a fallback.
- Throttled progress UI updates and lengthened the progress-bar transition for calmer movement.
- Renamed the desktop-only folder watcher to “Watch folder”.
- Tightened right alignment of Google Drive account actions on narrow screens.

Native iOS photo-library saving also requires installing `@capacitor-community/media` v9 (Capacitor 8 compatible) and adding the two Photo Library usage descriptions to `ios/App/App/Info.plist`. Those native steps are separate from this web-source ZIP.
