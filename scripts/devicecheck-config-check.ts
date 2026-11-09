import assert from "node:assert/strict";
import {
  createPrivateKey,
  sign,
  randomUUID,
  generateKeyPairSync,
} from "node:crypto";
async function main() {
  assert.equal(process.env.SITEAI_DEVICECHECK_QA, "1");
  const kid = process.env.APPLE_DEVICECHECK_KEY_ID?.trim(),
    pem = process.env.APPLE_DEVICECHECK_PRIVATE_KEY?.replace(/\\n/g, "\n");
  console.info("siteai_devicecheck_config_shape", {
    keyIdValid: /^[A-Z0-9]{10}$/.test(kid || ""),
    matchesRegisteredKeyId: kid === "X2P599R3BF",
    matchesTeam:
      (process.env.APPLE_SIGN_IN_TEAM_ID || "47LP6F2JXD") === "47LP6F2JXD",
    pemHeader: /^-----BEGIN PRIVATE KEY-----/.test(pem?.trim() || ""),
  });
  assert.ok(kid && pem && /^[A-Z0-9]{10}$/.test(kid));
  const key = createPrivateKey(pem),
    enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  assert.equal(key.asymmetricKeyDetails?.namedCurve, "prime256v1");
  const data = `${enc({ alg: "ES256", kid, typ: "JWT" })}.${enc({ iss: process.env.APPLE_SIGN_IN_TEAM_ID || "47LP6F2JXD", iat: Math.floor(Date.now() / 1000) })}`;
  const jwt = `${data}.${sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  async function validate(authorization: string) {
    const r = await fetch(
      "https://api.devicecheck.apple.com/v1/validate_device_token",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${authorization}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_token: Buffer.from(
            "deliberately invalid device token for configuration check",
          ).toString("base64"),
          transaction_id: randomUUID(),
          timestamp: Date.now(),
        }),
      },
    );
    const t = (await r.text()).trim();
    const outcome = [
      "Bad Device Token",
      "Invalid Authorization Token",
      "Bad Authorization Token",
      "Forbidden",
    ].includes(t)
      ? t
      : "other_response";
    return { httpStatus: r.status, outcome };
  }
  const configured = await validate(jwt);
  // A negative control checks whether Apple authenticates the JWT before
  // rejecting our deliberately invalid device token. Never print either JWT.
  const wrongKey = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  }).privateKey;
  const invalid = `${data}.${sign("sha256", Buffer.from(data), { key: wrongKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const control = await validate(invalid);
  console.info("siteai_devicecheck_config_result", {
    configured,
    control,
    realDeviceVerified: false,
    authenticationProven:
      configured.httpStatus === 400 && control.httpStatus === 401,
  });
  assert.equal(configured.httpStatus, 400);
  assert.equal(configured.outcome, "Bad Device Token");
}
void main().catch(() => {
  console.error(
    "siteai_devicecheck_config_failed: check the dedicated DeviceCheck key settings",
  );
  process.exitCode = 1;
});
