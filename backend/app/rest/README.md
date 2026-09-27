```
deno task start
```

## REST authentication and ownership

The Auth0 browser session identifies the caller. Write routes, library/book/
highlight reads (including book downloads), and profile-picture downloads
resolve its `sub` against `user.authId`; profile pictures are self-only.
Client-supplied user IDs, resource IDs, the `userinfo` cookie, and unverified
bearer tokens are not credentials. Authentication failures return 401;
inaccessible resources return 404. Browser writes from another origin are
rejected.

Libraries are private and have a nullable `owner` relation for compatibility
with existing rows. **Before relying on existing libraries after deployment,**
backfill their `owner_id` from a verified source. Where every book in a library
belongs to the same user, that user can be assigned as its owner; libraries with
no books or books from multiple users require manual review. Until an owner is
assigned, existing libraries cannot be fetched, changed, or used for new books.
After all libraries are accounted for, make `owner` non-nullable.

The mobile client currently sends Auth0 bearer tokens, not the browser session.
Those tokens are not accepted as authentication by this API. Supporting mobile
calls requires configuring an Auth0 API audience in the client and verifying
issuer, signature, expiration, and audience on the backend before using `sub`.
