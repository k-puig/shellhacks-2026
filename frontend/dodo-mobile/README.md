# DODO mobile

Voice-controlled audiobook reader (Expo SDK 57, React Native 0.86, New Architecture). iOS is the primary target.

## Requirements

- Node 20+, Xcode with an iOS 26+ SDK, CocoaPods
- An Apple account (free works) to install on a physical iPhone, with Developer Mode on
- iPhone and Mac on the same Wi-Fi network

This app uses native modules (speech recognition, secure store), so it needs a **development build**. Expo Go won't work.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys; see comments in the file
```

To sign with your own Apple account, set `DODO_IOS_BUNDLE_ID` and `DODO_APPLE_TEAM_ID` in `.env.local`. They override `app.json` through `app.config.js`, so don't edit `app.json` for this.

## Login (Auth0)

- Uses the **DODO Mobile** Native application in the `dodocall` tenant, not the website's app, which requires a client secret. In `.env.local`, set `EXPO_PUBLIC_AUTH0_DOMAIN` and that app's `EXPO_PUBLIC_AUTH0_CLIENT_ID`, and leave `EXPO_PUBLIC_AUTH0_AUDIENCE` unset.
- In Auth0, the DODO Mobile app must list `dodomobile://auth` in both **Allowed Callback URLs** and **Allowed Logout URLs**.
- Flow: Authorization Code + PKCE. Tokens are kept in the iOS Keychain (`expo-secure-store`) and refreshed automatically. Logout ends the Auth0 session only; it doesn't sign you out of Google.
- To skip login during local testing, set `EXPO_PUBLIC_SKIP_LOGIN=1`. The app then opens straight to Home as Guest.
- The "Dev Keys" banner on the login page is expected, because Google login uses Auth0's test keys.

## Run

```bash
# First time, or after native changes (new native package, app.json/plugins, Info.plist keys):
npx expo run:ios --device          # pick your iPhone; builds and installs

# Every day after that:
npx expo start --dev-client --lan -c
```

Open DODO on the phone and choose your Mac's server from the dev launcher, or open the URL shown by Metro. Add `-c` whenever `.env.local` changes, because env values are bundled at start.

## Adding books

On Home, tap **＋ Add book** and pick an `.epub` (from Files, iCloud Drive, AirDrop…). The app converts it on the phone (`src/data/epub.ts`), with its cover, and it shows up first in the library, even offline. Free EPUBs to try: [Project Gutenberg](https://www.gutenberg.org) (for example `https://www.gutenberg.org/ebooks/11.epub3.images` opened in Safari on the iPhone).

- Chapters come from the book's files in reading order. Contents, copyright, index and Project Gutenberg license pages are skipped, and so are code, tables and images, because they can't be read aloud.
- When `EXPO_PUBLIC_API_URL` is set, the `.epub` is also uploaded to the backend (stored in S3) under the same id, in the background. If the upload fails, for example offline, the book stays on the phone.
- Adding a book that's already there shows "Already in your library". A full book you add hides the built-in sample of the same book.
- PDFs aren't supported. Only EPUBs can be picked.

## Your data

- Added books are saved **on the phone** as `books/<id>.json`, with their cover as `books/<id>-cover.jpg`.
- Highlights, notes, asked questions and reading position are saved **on the phone** (`saved-items.json` and `reading-progress.json` in the app's storage), so they survive closing the app. They belong to the phone, not the account, until backend sync lands. Settings → Your data clears them.
- `src/api/` holds the backend client. On its first request (or whenever the backend answers 401) it logs into the backend with `POST /user/mobile-login`, which trades the Auth0 token for the backend's cookie, then retries. It signs out only if that also fails. No screen uses it yet. Set `EXPO_PUBLIC_API_URL` when one does. The backend's endpoints are listed in `backend/app/rest/README.md`.

## Voice commands

Say **"Hey DODO"**, pause for a moment, then give the command. For example: `pause`, `play`, `go back`, `skip`, `next chapter`, `faster`, `slower`, `highlight that`, `highlight that in blue`, `note …`, or a question like `who is …?`. The full list is in Settings.

**With the screen locked or another app open:** while a book is being narrated, DODO keeps listening, and keeps going for 2 minutes after a pause. iOS shows its orange mic dot while it does. Currently **one command works per trip out of the app**:
- After each command, the listener ends its speech session and starts a new one, to clear what it already heard.
- iOS lets a background app keep a recording that's already running, but won't let it *start* a new one, so that restart is refused (`audio-capture`, OSStatus `!int`).
- Opening the app starts listening again.

The fix is to keep one session running in the background and skip past handled words instead of restarting (see `src/voice/useWakeWord.ts`).

## Checks

```bash
npx tsc --noEmit && npm run lint && npm test
```

## Troubleshooting

- **App closes immediately on the phone:** the installed build is stale or missing a permission key. Rebuild with `npx expo run:ios --device`.
- **Stuck on "Searching for development servers":** phone and Mac aren't on the same network, or Metro isn't running. Enter `http://<mac-lan-ip>:8081` manually.
- **Narration or questions error out:** the ElevenLabs or Gemini key is missing from `.env.local`. Restart Metro with `-c` after adding it.
- **Wake word missed:** pause briefly after "Hey DODO" before the command.
- **Auth0 "Oops!, something went wrong":** check the Auth0 dashboard under Monitoring → Logs for the reason. The usual causes are a missing callback or logout URL, the wrong Client ID, or an audience that doesn't exist ("Service not found").
