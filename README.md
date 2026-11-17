# qwervlog

just stuff i do.

A browser-based vlog camera: 2-second clips, 6-second timelapses, automatic timestamps and three-frame collages. Recordings are stored locally in your browser using IndexedDB.

## Run

Serve this directory with any static HTTP server, for example `python3 -m http.server 8000`. Camera access requires HTTPS or localhost.

## Deploy

GitHub Pages: publish the `main` branch from `/ (root)`. No build step or API keys are required.

Browser storage is tied to the site address. Clips on another deployment are not migrated automatically.


## Phone backup and open-ended timelapse

- Timelapse starts after the countdown and stops on a second shutter tap. The length setting is output duration (default 6 seconds), not a capture deadline. Keep the page visible; screen wake lock is requested where available.
- Sampling is bounded to 360 JPEG frames, thinning evenly as recording grows. This is a compressed timelapse source, not a full-duration recording. Long sessions still require device testing.
- Before review, a separate 1080×1920 clean video is encoded without captions, time, or collage. Keep invokes file sharing synchronously, before IndexedDB persistence. The user must select Save Video on iOS; sharing completion is not proof of Photos storage. Unsupported file sharing falls back to file download. The last prepared backup can be shared again until a new clip is prepared or the page is reloaded.
- MP4 creation timestamps use the actual capture start. A custom UUID box carries capture start, output duration, and mode; timestamp is also in the file name. Import reads the UUID, Apple QuickTime shooting date, or original backup filename. Generic MP4 creation dates are not trusted because they can describe transcoding. Missing capture time stays blank. Photos/transcoding may remove metadata; verify a round-trip on the target iPhone. Video metadata is separate from baked-in pixels. Edited captions and collage placement are not backed up in the clean source.
- Rear-camera selection prefers explicitly labelled standard wide cameras. Zoom 1x is the selected camera's minimum hardware zoom. Browsers do not guarantee equivalence to Apple's Camera app; 0.5x switches to an explicitly named rear ultrawide device when exposed by the browser; 1x switches back to standard wide. Unsupported 0.5x is disabled instead of creating black margins.

Checks: `node tests/backup.test.cjs` and `node tests/capture.test.cjs`.
