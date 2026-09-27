import { assertEquals } from "@std/assert";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createAuth0BearerVerifier } from "./auth0-bearer.ts";

Deno.test("Auth0 bearer verifier checks signature, audience, issuer and expiry", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...await exportJWK(publicKey),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const fetchJwks = (async () =>
    new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  const verify = createAuth0BearerVerifier(
    "example.auth0.com",
    "https://api.dodo.test",
    fetchJwks,
  );
  const sign = (issuer: string, audience: string, expiresIn: string) =>
    new SignJWT({ sub: "auth0|owner" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);

  assertEquals(
    await verify(
      await sign("https://example.auth0.com/", "https://api.dodo.test", "1h"),
    ),
    "auth0|owner",
  );
  assertEquals(
    await verify(await sign("https://example.auth0.com/", "other-api", "1h")),
    null,
  );
  assertEquals(
    await verify(
      await sign("https://other.auth0.com/", "https://api.dodo.test", "1h"),
    ),
    null,
  );
  assertEquals(
    await verify(
      await sign("https://example.auth0.com/", "https://api.dodo.test", "-1h"),
    ),
    null,
  );

  const otherKey = await generateKeyPair("RS256");
  const forged = await new SignJWT({ sub: "auth0|owner" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://example.auth0.com/")
    .setAudience("https://api.dodo.test")
    .setExpirationTime("1h")
    .sign(otherKey.privateKey);
  assertEquals(await verify(forged), null);
});

Deno.test("missing API configuration fails closed", async () => {
  assertEquals(
    await createAuth0BearerVerifier("example.auth0.com", undefined)("anything"),
    null,
  );
});
