# DODO

A voice-controlled audiobook reader, built at ShellHacks 2026. You listen to a book read aloud on your iPhone and control it hands-free: **"Hey Nova, pause"**, "faster", "next chapter", "highlight that", "note …", or ask about the story ("Who is the Dodo?").

## What's in this repo

| Folder | What it is | How to run it |
|---|---|---|
| [`frontend/dodo-mobile`](frontend/dodo-mobile/README.md) | The iPhone app: Expo (React Native), on-device speech recognition, ElevenLabs narration, Gemini, Auth0 login, on-phone EPUB conversion | [Mobile README](frontend/dodo-mobile/README.md) |
| [`backend/app/rest`](backend/app/rest/README.md) | REST API: Deno + Hono, PostgreSQL (MikroORM), RustFS (S3-compatible) for EPUB files | [Backend README](backend/app/rest/README.md) |
| `backend/app/splash`, `backend/app/protoweb` | The website (splash page and web client) | Served by the Docker setup |
| `docker-compose.yml` | Production stack behind nginx (API, website, RustFS) | `docker compose up -d --build` |

Live at **https://dodo.gay**.

## Quick start

**iPhone app** (macOS, Xcode, Node 20.19+, CocoaPods):

```bash
cd frontend/dodo-mobile
npm install
cp .env.example .env.local        # fill in keys (ask a teammate)
npx expo run:ios --device         # first build onto your iPhone
npx expo start --dev-client --lan -c
```

**Backend** (Docker, settings in a root `.env`):

```bash
docker compose -f docker-compose.yml.local up -d --build   # local, with Postgres
```

Secrets (`.env`, `.env.local`, `backend/env`) are git-ignored. Never commit them.
