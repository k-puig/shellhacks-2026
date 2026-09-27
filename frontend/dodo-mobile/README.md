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

## Run

```bash
# First time, or after native changes (new native package, app.json/plugins, Info.plist keys):
npx expo run:ios --device          # pick your iPhone; builds and installs

# Every day after that:
npx expo start --dev-client --lan -c
```

Open DODO on the phone and choose your Mac's server from the dev launcher, or open the URL shown by Metro. Add `-c` whenever `.env.local` changes, because env values are bundled at start.

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
