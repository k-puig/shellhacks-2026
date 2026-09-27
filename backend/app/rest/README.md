# DODO REST API

Hono on Deno; Postgres stores records and RustFS stores uploaded files. Routes
are under `/api/v1`.

## Run

**Full stack with Docker** (API, website, nginx, RustFS; this is how `dodo.gay` runs). From the repo root, with the settings below in a root `.env` (git-ignored):

```bash
docker compose up -d --build                             # production: uses an external Postgres (POSTGRES_* settings)
docker compose -f docker-compose.yml.local up -d --build # local: also starts a Postgres container
docker compose logs dodo-rest --tail 100                 # errors are logged as "<METHOD> <path> failed: …"
```

Rebuild (`--build`) after backend changes: a plain restart keeps the old image.

On startup the API creates any missing tables (safe schema update, nothing dropped) and the `epub`/`pfp` buckets.

**API only, with Deno 2.9+** (needs a reachable Postgres and RustFS):

```bash
cd backend
deno task rest                      # deno run --allow-sys --allow-net --allow-env app/rest/main.ts
deno check app/rest/main.ts         # type-check (must report no errors)
deno lint
RUSTFS_ACCESS_KEY=test RUSTFS_SECRET_KEY=test deno test --allow-env app/rest   # unit tests (dummy keys are enough)
```

`--allow-sys` is required: the AWS S3 SDK reads the OS version on every call, and without it all uploads fail with "Requires sys access".

**Settings** (environment variables; never commit them):

| Variable | What it is |
|---|---|
| `AUTH0_DOMAIN` | `dodocall.us.auth0.com`, with no `https://` |
| `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` | The website's Auth0 application |
| `AUTH0_API_AUDIENCE` | Identifier of the Auth0 API (`https://dodo.gay/`). Must equal the mobile app's `EXPO_PUBLIC_AUTH0_AUDIENCE`; without it every mobile request gets 401 |
| `BASE_URL` | Public site URL, e.g. `https://dodo.gay` |
| `SESSION_SECRET`, `COOKIE_SECRET` | Random secrets for the website session |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database (compose passes them to the API as `PGSQL_*`) |
| `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY` | RustFS (S3) credentials |

## Auth0 setup

Register an **Auth0 API** for this backend using **RS256**, and set its
Identifier as `AUTH0_API_AUDIENCE` on the backend and
`EXPO_PUBLIC_AUTH0_AUDIENCE` in the mobile app. Both values must be identical.
`AUTH0_DOMAIN` is the tenant domain (without `https://`). Browser login
continues to use `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `BASE_URL`, and
`SESSION_SECRET`; the mobile Native Application has its own client ID. Never put
backend secrets into the mobile app.

Website requests use the Auth0 browser session. Mobile requests send
`Authorization: Bearer <API access token>`; the backend checks the token
signature against Auth0 JWKS, issuer, RS256 algorithm, expiration, and API
audience. `POST /user/mobile-login` requires that verified bearer and provisions
the matching user on first login. The client retries its original request once
after provisioning. All protected requests resolve the authenticated `sub`
against `user.authId`, then check that database user's resource ownership. An
invalid bearer never falls back to a browser session. Legacy `userinfo` cookies
are **not authorization credentials**; `GET /user` loads the verified caller's
current database record. Browser-session cross-origin writes are rejected.

Authentication failures return 401; missing or other users' resources
return 404. Library, book, highlight, and note routes (including reads and
downloads) require authentication. Profile-picture downloads are self-only.

## Resources

API envelopes have `{ code, message, content }`; file downloads stream binary
data instead. The server generates resource IDs. A book can optionally belong to
an **owned** library; if a library ID is supplied on create/update, ownership is
checked before any S3 operation.

| Route                                                                                                                               | Purpose                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /user/login`, `/user/callback`, `/user/logout`                                                                                 | Browser sign-in/out                                   |
| `POST /user/mobile-login`                                                                                                           | Provision the account for a verified mobile API token |
| `GET /user`, `PATCH /user/update`, `PATCH /user/profile-picture`, `DELETE /user/delete`                                             | Account                                               |
| `GET /user/:id/profile-picture`                                                                                                     | Own profile picture                                   |
| `POST /book`, `GET /book`, `GET /book/:id`, `GET /book/:id/file`, `PATCH /book/:id`, `PATCH /book/:id/progress`, `DELETE /book/:id` | Own books and EPUB files                              |
| `POST /library`, `GET /library/:id`, `DELETE /library/:id`                                                                          | Own optional libraries                                |
| `POST /highlight`, `GET /highlight/:id`, `GET /highlight/book/:bookId`, `DELETE /highlight/:id`                                     | Highlights on own books                               |
| `POST /note`, `GET /note/:id`, `GET /note/book/:bookId`, `PUT /note/:id`, `DELETE /note/:id`                                        | Notes on own highlights                               |

`POST /book` accepts multipart `book` (EPUB), `title`, `author`, and optional
`libraryId`. Use the returned `content.id` for future requests.
`PATCH /book/:id/progress` takes `{ "position": <word index> }`. Word index is
now the unit of `book.progress`; older seconds-based progress **cannot be
converted reliably without reading the EPUB**, so existing values must be
reviewed or reset during deployment. Before using library-less books against an
existing database, verify that `book.library_id` is nullable (and explicitly
remove its NOT NULL constraint if the safe startup schema update does not).

Libraries have a nullable owner relation for legacy data. Backfill `owner_id`
from a verified source before relying on existing libraries: a library whose
books all belong to one user can be assigned to that user; empty or multi-user
libraries need manual review. Unowned legacy libraries remain inaccessible. Once
all are accounted for, make the owner relation non-nullable.

The mobile app keeps offline EPUB copies and locally stored highlights/notes;
remote books are shown separately until download and saved-item sync are
implemented.
