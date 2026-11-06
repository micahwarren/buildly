import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { DesignError } from "../services/image-design";

const issuer = "https://appleid.apple.com";
const unavailable = () =>
  new DesignError(
    "Apple authorization could not be removed. Please retry account deletion or contact support.",
    503,
  );

/** Validate configuration before placing the account behind its deletion fence. */
export function prepareAppleRevocation(
  user: User,
  code: unknown,
  request: typeof fetch = fetch,
) {
  const identity = user.identities?.find((item) => item.provider === "apple");
  const usesApple =
    !!identity || user.app_metadata.providers?.includes("apple") === true;
  if (!usesApple) return async () => {};
  const subject = identity?.identity_data?.sub;
  if (typeof subject !== "string" || !subject) throw unavailable();
  if (typeof code !== "string" || !/^[A-Za-z0-9._-]{1,4096}$/.test(code))
    throw new DesignError(
      "Confirm with Apple again before deleting your account.",
      401,
    );
  const pem = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
  const team = process.env.APPLE_SIGN_IN_TEAM_ID || "47LP6F2JXD";
  const client = "com.nomapps.buildly";
  if (
    !pem ||
    !keyId ||
    !/^[A-Z0-9]{10}$/.test(keyId) ||
    !/^[A-Z0-9]{10}$/.test(team)
  )
    throw new DesignError(
      "Apple account deletion needs a server configuration update. Please contact support.",
      503,
    );
  let privateKey;
  try {
    privateKey = createPrivateKey(pem);
    if (
      privateKey.asymmetricKeyType !== "ec" ||
      privateKey.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    )
      throw Error("Unexpected signing key");
  } catch {
    throw unavailable();
  }
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: keyId, typ: "JWT" })}.${encode(
    {
      iss: team,
      iat: now,
      exp: now + 300,
      aud: issuer,
      sub: client,
    },
  )}`;
  const secret = `${unsigned}.${sign("sha256", Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url")}`;

  return async () => {
    // One deadline bounds exchange, identity verification and revocation together.
    const signal = AbortSignal.timeout(25_000);
    const post = (path: string, fields: Record<string, string>) =>
      request(issuer + path, {
        method: "POST",
        redirect: "error",
        signal,
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: client,
          client_secret: secret,
          ...fields,
        }),
      });
    try {
      const exchanged = await post("/auth/token", {
        code,
        grant_type: "authorization_code",
      });
      if (!exchanged.ok) throw unavailable();
      const tokens = await exchanged.json();
      if (
        typeof tokens.id_token !== "string" ||
        tokens.id_token.length > 16_384
      )
        throw unavailable();
      const parts = tokens.id_token.split(".");
      if (parts.length !== 3) throw unavailable();
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      const current = Math.floor(Date.now() / 1000);
      if (
        header.alg !== "RS256" ||
        typeof header.kid !== "string" ||
        claims.iss !== issuer ||
        claims.aud !== client ||
        claims.sub !== subject ||
        typeof claims.exp !== "number" ||
        claims.exp <= current ||
        typeof claims.iat !== "number" ||
        claims.iat > current + 60
      )
        throw unavailable();
      const response = await request(issuer + "/auth/keys", {
        signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) throw unavailable();
      const jwks = await response.json();
      if (!Array.isArray(jwks.keys) || jwks.keys.length > 10)
        throw unavailable();
      const jwk = jwks.keys.find(
        (key: { kid?: string; alg?: string; kty?: string; use?: string }) =>
          key.kid === header.kid &&
          key.alg === "RS256" &&
          key.kty === "RSA" &&
          key.use === "sig",
      );
      if (
        !jwk ||
        !verify(
          "RSA-SHA256",
          Buffer.from(`${parts[0]}.${parts[1]}`),
          createPublicKey({ key: jwk, format: "jwk" }),
          Buffer.from(parts[2], "base64url"),
        )
      )
        throw unavailable();
      // The code must belong to the same Apple identity as the authenticated account.
      // Never accept a token or Apple subject supplied directly by the client.
      const token = tokens.refresh_token || tokens.access_token;
      if (typeof token !== "string" || !token || token.length > 8192)
        throw unavailable();
      const revoked = await post("/auth/revoke", {
        token,
        token_type_hint: tokens.refresh_token
          ? "refresh_token"
          : "access_token",
      });
      if (!revoked.ok) throw unavailable();
    } catch {
      // Do not include response bodies, authorization codes, tokens or keys in logs/errors.
      throw unavailable();
    }
  };
}
