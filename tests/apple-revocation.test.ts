import test from "node:test";
import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
  verify,
  createPublicKey,
} from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { prepareAppleRevocation } from "../lib/accounts/apple-revocation";
const owner = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  created_at: new Date().toISOString(),
  user_metadata: {},
  app_metadata: { providers: ["email", "apple"] },
  identities: [
    {
      provider: "apple",
      id: "apple-owner",
      identity_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      identity_data: { sub: "apple-owner" },
    },
  ],
} as User;
const clientKeys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const appleKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
function configure() {
  const names = [
    "APPLE_SIGN_IN_KEY_ID",
    "APPLE_SIGN_IN_PRIVATE_KEY",
    "APPLE_SIGN_IN_TEAM_ID",
  ];
  const before = names.map((n) => process.env[n]);
  process.env.APPLE_SIGN_IN_KEY_ID = "ABCDEFGHIJ";
  process.env.APPLE_SIGN_IN_TEAM_ID = "47LP6F2JXD";
  process.env.APPLE_SIGN_IN_PRIVATE_KEY = clientKeys.privateKey
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  return () =>
    names.forEach((n, i) => {
      if (before[i] === undefined) delete process.env[n];
      else process.env[n] = before[i];
    });
}
function idToken(overrides: Record<string, unknown> = {}, signed = true) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (x: object) =>
    Buffer.from(JSON.stringify(x)).toString("base64url");
  const data = `${encode({ alg: "RS256", kid: "apple-fixture" })}.${encode({
    iss: "https://appleid.apple.com",
    aud: "com.nomapps.buildly",
    sub: "apple-owner",
    iat: now,
    exp: now + 300,
    ...overrides,
  })}`;
  return `${data}.${signed ? sign("RSA-SHA256", Buffer.from(data), appleKeys.privateKey).toString("base64url") : "forged"}`;
}
function requests(token: string, failPath = "") {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const u = new URL(String(input));
    assert.equal(u.origin, "https://appleid.apple.com");
    calls.push(u.pathname);
    assert.equal(init?.redirect, "error");
    if (u.pathname === failPath) return new Response(null, { status: 503 });
    if (u.pathname === "/auth/keys")
      return Response.json({
        keys: [
          {
            ...appleKeys.publicKey.export({ format: "jwk" }),
            kid: "apple-fixture",
            alg: "RS256",
            use: "sig",
          },
        ],
      });
    const fields = new URLSearchParams(String(init?.body));
    assert.equal(fields.get("client_id"), "com.nomapps.buildly");
    const parts = fields.get("client_secret")!.split(".");
    assert.ok(
      verify(
        "sha256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        {
          key: createPublicKey(clientKeys.privateKey),
          dsaEncoding: "ieee-p1363",
        },
        Buffer.from(parts[2], "base64url"),
      ),
    );
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    assert.equal(claims.sub, "com.nomapps.buildly");
    assert.equal(claims.iss, "47LP6F2JXD");
    assert.ok(claims.exp - claims.iat <= 300);
    if (u.pathname === "/auth/token") {
      assert.equal(fields.get("code"), "fresh.apple.code");
      return Response.json({
        id_token: token,
        refresh_token: "private-test-refresh",
      });
    }
    assert.equal(u.pathname, "/auth/revoke");
    assert.equal(fields.get("token"), "private-test-refresh");
    assert.equal(fields.get("token_type_hint"), "refresh_token");
    return new Response(null, { status: 200 });
  };
  return { fetcher, calls };
}
test("deletion exchanges the fresh Apple code, verifies identity/signature, then revokes its refresh token", async () => {
  const reset = configure();
  try {
    const f = requests(idToken());
    await prepareAppleRevocation(owner, "fresh.apple.code", f.fetcher)();
    assert.deepEqual(f.calls, ["/auth/token", "/auth/keys", "/auth/revoke"]);
  } finally {
    reset();
  }
});
test("Apple deletion fails closed for another identity, wrong audience, expired or forged token and provider failure", async () => {
  const reset = configure();
  try {
    for (const token of [
      idToken({ sub: "someone-else" }),
      idToken({ aud: "other-app" }),
      idToken({ exp: 1 }),
      idToken({}, false),
    ]) {
      const f = requests(token);
      await assert.rejects(
        prepareAppleRevocation(owner, "fresh.apple.code", f.fetcher),
        /could not be removed/,
      );
      assert.equal(f.calls.includes("/auth/revoke"), false);
    }
    for (const path of ["/auth/token", "/auth/keys", "/auth/revoke"]) {
      const f = requests(idToken(), path);
      await assert.rejects(
        prepareAppleRevocation(owner, "fresh.apple.code", f.fetcher),
        /could not be removed/,
      );
    }
  } finally {
    reset();
  }
});
test("missing Apple code/key cannot complete deletion; email-only accounts need neither", async () => {
  const reset = configure();
  try {
    assert.throws(
      () => prepareAppleRevocation(owner, null),
      /Confirm with Apple/,
    );
    delete process.env.APPLE_SIGN_IN_PRIVATE_KEY;
    assert.throws(
      () => prepareAppleRevocation(owner, "fresh.apple.code"),
      /server configuration/,
    );
    await prepareAppleRevocation(
      { app_metadata: { providers: ["email"] } } as User,
      undefined,
      async () => {
        throw Error("must not contact Apple");
      },
    )();
  } finally {
    reset();
  }
});
