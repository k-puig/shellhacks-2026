# Vite + Deno + React + TypeScript

## Running

You need to have Deno v2.0.0 or later installed to run this repo.

Start a dev server:

```bash
$ deno task dev
```

## Demo video and Android download

The landing page has a video slot in the **A closer look** section (`#demo`) and an APK download slot in the closing **Take the story with you** section (`#discover`). Both display coming-soon states until the assets are ready.

In `src/App.tsx`, set `YOUTUBE_VIDEO_ID` to the ID from the YouTube watch URL (not the full URL) to show the privacy-enhanced, lazy-loaded embed. Set `APK_DOWNLOAD_URL` to a public HTTPS URL for the released `.apk` to replace the coming-soon message with a download link. No placeholder links are active in the meantime.

## Deploy

Build production assets:

```bash
$ deno task build
```
