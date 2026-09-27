# DODO REST API

Hono on Deno. Postgres (MikroORM) holds the data and RustFS (S3-compatible) holds the files. Everything is served under `/api/v1`.

## Run and check

```bash
deno task start                      # from backend/app/rest (or `deno task rest` from backend/)
deno check main.ts                   # type-check; must report no errors
deno lint
```

It needs the env vars in `backend/env` (git-ignored; get them from a teammate privately): `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `BASE_URL`, `SESSION_SECRET`, `COOKIE_SECRET`, `PGSQL_*`, `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`. The full stack (Postgres, RustFS, nginx) runs with `docker compose` from the repo root.

## Login

Both logins end with the same signed **`userinfo` cookie**, and `requireUser` (`lib/auth/current-user.ts`) reads it:

- **Website:** `GET /user/login` → Auth0 → `/user/callback` → `/user/callback/complete` sets the cookie.
- **Phone:** the app signs in with Auth0 itself (the "DODO Mobile" native app), then calls `POST /user/mobile-login` with `Authorization: Bearer <access token>`. The backend confirms the token with Auth0's `/userinfo`, finds or creates the user, and sets the cookie.

Library, book, highlight and note routes require the cookie (401 without it). They act on the signed-in user's data only, and another user's item returns 404.

## Endpoints

Replies are `{ code, message, content }`. Book routes also use `code` as the HTTP status.

| Route | What it does |
|---|---|
| `GET /user/login`, `/user/callback`, `/user/logout` | Website login and logout |
| `POST /user/mobile-login` | Phone login (see above) |
| `GET /user` | The signed-in user |
| `PATCH /user/update`, `/user/profile-picture`; `DELETE /user/delete` | Rename, profile picture, delete account |
| `POST /book` | Upload an `.epub` (multipart: `book`, `title`, `author`, optional `id`, `libraryId`). Stored in RustFS at `books/<userId>/<id>.epub` |
| `GET /book` | My books, newest first, each with `s3Key` and `progress` |
| `GET /book/:id` | One of my books |
| `GET /book/:id/file` | The book's `.epub`, streamed from RustFS |
| `DELETE /book/:id` | Delete the book and its file |
| `POST /library`, `GET·DELETE /library/:id` | Libraries: optional folders for books |
| `POST /highlight`, `GET·DELETE /highlight/:id` | Highlights (a start and end word position in a book) |
| `POST /note`, `GET /note/book/:bookId`, `GET·PUT·DELETE /note/:id` | Notes, each attached to a highlight |
