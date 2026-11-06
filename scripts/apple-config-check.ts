import assert from "node:assert/strict";
import { createPrivateKey, sign } from "node:crypto";
async function main() {
  assert.equal(process.env.SITEAI_APPLE_CONFIG_QA, "1");
  const pem = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.APPLE_SIGN_IN_KEY_ID;
  const team = process.env.APPLE_SIGN_IN_TEAM_ID || "47LP6F2JXD";
  assert.ok(
    pem && kid && /^[A-Z0-9]{10}$/.test(kid),
    "Apple sign-in key configuration is missing or malformed",
  );
  const key = createPrivateKey(pem);
  assert.equal(key.asymmetricKeyType, "ec");
  assert.equal(key.asymmetricKeyDetails?.namedCurve, "prime256v1");
  const now = Math.floor(Date.now() / 1000),
    client = "com.nomapps.buildly";
  const enc = (x: object) =>
    Buffer.from(JSON.stringify(x)).toString("base64url");
  const data = `${enc({ alg: "ES256", kid, typ: "JWT" })}.${enc({ iss: team, iat: now, exp: now + 300, sub: client, aud: "https://appleid.apple.com" })}`;
  const secret = `${data}.${sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // Deliberately unusable code: no real user's account or authorization is touched.
    body: new URLSearchParams({
      client_id: client,
      client_secret: secret,
      grant_type: "authorization_code",
      code: "siteai-deliberately-invalid-configuration-check",
    }),
  });
  const result = await response.json();
  const outcome = [
    "invalid_grant",
    "invalid_client",
    "unauthorized_client",
  ].includes(result.error)
    ? result.error
    : "unexpected_response";
  console.info("siteai_apple_config_check", {
    pemValid: true,
    client: "existing_native_bundle",
    httpStatus: response.status,
    outcome,
    liveDeletionVerified: false,
  });
  assert.equal(
    response.status,
    400,
    "Apple configuration check returned an unexpected status",
  );
  assert.equal(
    outcome,
    "invalid_grant",
    "Apple did not accept the configured native client credential",
  );
}
void main().catch(() => {
  console.error(
    "siteai_apple_config_check_failed: key/client validation needs attention; no real authorization was used",
  );
  process.exitCode = 1;
});
