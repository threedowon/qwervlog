# qwervlog

just stuff i do.

A browser-based vlog camera: 2-second clips, 6-second timelapses, automatic timestamps and three-frame collages. Recordings are stored locally in your browser using IndexedDB.

## Run

Serve this directory with any static HTTP server, for example `python3 -m http.server 8000`. Camera access requires HTTPS or localhost.

## Deploy

GitHub Pages: publish the `main` branch from `/ (root)`. No build step or API keys are required.

Browser storage is tied to the site address. Clips on another deployment are not migrated automatically.
