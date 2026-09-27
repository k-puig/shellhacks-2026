import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";

/** Verify API access tokens issued to the Auth0 API, never ID tokens. */
export function createAuth0BearerVerifier(
  domain: string | undefined,
  audience: string | undefined,
  fetchJwks?: typeof fetch,
): (token: string) => Promise<string | null> {
  if (!domain || !/^[a-z0-9.-]+$/i.test(domain) || !audience) {
    // Browser sessions can still operate, but mobile requests fail closed until
    // the Auth0 API identifier is configured on the server.
    return () => Promise.resolve(null);
  }

  const issuer = `https://${domain}/`;
  const jwks = createRemoteJWKSet(
    new URL(`${issuer}.well-known/jwks.json`),
    fetchJwks ? { [customFetch]: fetchJwks } : undefined,
  );
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ["RS256"],
      });
      return typeof payload.sub === "string" && payload.sub.length > 0 &&
          typeof payload.exp === "number"
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  };
}
