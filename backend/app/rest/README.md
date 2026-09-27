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

Library, book, highlight and note routes require the cookie (401 without it). Book, highlight and note routes act on the signed-in user's data only, and another user's item returns 404. Libraries have no owner yet, so any signed-in user can reach any library.

## Endpoints

Replies are `{ code, message, content }`. On book, highlight and note routes, `code` is also the HTTP status. Library routes still reply HTTP 200 with the real status in `code`.

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
| `PATCH /book/:id/progress` | Where the reader is: `{ "position": <word index> }`. Also sets `lastAccessedAt` |
| `DELETE /book/:id` | Delete the book and its file |
| `POST /library`, `GET·DELETE /library/:id` | Libraries: optional folders for books |
| `POST /highlight`, `GET·DELETE /highlight/:id` | Highlights: a `start` and `end` word position in one of my books. Deleting one also deletes its note |
| `GET /highlight/book/:bookId` | A book's highlights, in reading order |
| `POST /note`, `GET /note/book/:bookId`, `GET·PUT·DELETE /note/:id` | Notes: one per highlight (a second one gets 409) |

Ownership: a book belongs to its uploader. Highlights and notes belong to whoever owns their book (note → highlight → book), so they need no owner column. Clients may send their own UUID `id` when creating books, highlights and notes, so an item keeps the same id on every device.
