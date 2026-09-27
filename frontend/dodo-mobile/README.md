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

- Use the **DODO Mobile** Native application in the `dodocall` tenant, not the website's confidential app. In `.env.local`, set `EXPO_PUBLIC_AUTH0_DOMAIN`, its `EXPO_PUBLIC_AUTH0_CLIENT_ID`, and `EXPO_PUBLIC_AUTH0_AUDIENCE` to the **Identifier** of the Auth0 API protected by the backend (not the mobile client ID or `/userinfo`). Configure the backend's audience to the same identifier and its Auth0 domain to the same tenant. Restart Metro with `-c` after changing these values. The API must allow the native application to request access tokens; an absent or incorrect audience will not yield a backend-verifiable API token.
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
- When signed in and `EXPO_PUBLIC_API_URL` is set, the `.epub` is uploaded to the backend (stored in S3). The backend assigns a separate ID; the phone stores an account-scoped local-to-remote ID mapping. An upload failure is shown on Home; the book stays readable on the phone. To retry after coming back online, tap **Add book** and select the same EPUB again: the local copy is kept, and the fresh picked file is uploaded if this account has no mapping. Already-mapped books are not uploaded twice. Failed uploads are not queued automatically.
- Reimporting a book already on this phone shows whether it was synced or is still offline. A full book you add hides the built-in sample of the same book.
- PDFs aren't supported. Only EPUBs can be picked.

## Your data

- Home lists **Account books** from `GET /book` when online, and **On this phone** from locally converted EPUBs and samples. Account-only books are listed but cannot yet be downloaded/opened; add an EPUB on this phone to read it offline. A locally imported book is readable even if account listing or upload fails.
- Added books are saved **on the phone** as `books/<local-id>.json`, with their cover as `books/<local-id>-cover.jpg`. Account IDs are tracked separately in `remote-book-ids.json`, per Auth0 subject.
- Highlights, notes, asked questions and reading position are saved **on the phone** (`saved-items.json` and `reading-progress.json` in the app's storage), so they survive closing the app. For signed-in books with a saved remote ID, paragraph/pause word-index positions are also debounced to `PATCH /book/:id/progress` and flushed on reader exit; failed sync does not interrupt local reading. Progress for unmapped or guest books remains local. Highlights, notes and questions are not yet synced. Settings → Your data clears local saved items.
- `src/api/` refuses backend requests when the API URL is configured but `EXPO_PUBLIC_AUTH0_AUDIENCE` is missing or blank, before obtaining or sending a token; local/guest reading still works. It sends an Auth0 API access token as a bearer on every backend request; no cookie exchange. On 401 it calls `POST /user/mobile-login` with that bearer for provisioning and retries once only if provisioning succeeds. A backend 401 does not sign out of Auth0; missing tokens do not make backend calls. Set `EXPO_PUBLIC_API_URL` to the backend origin (the client appends `/api/v1`). Local progress remains available offline; remote file download and remote progress restoration are not yet implemented.

## Voice commands

Say **"Hey DODO"**, pause for a moment, then give the command. For example: `pause`, `play`, `go back`, `skip`, `next chapter`, `faster`, `slower`, `highlight that`, `highlight that in blue`, `note …`, or a question like `who is …?`. The full list is in Settings.

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
