import { adultEligibilityChoice } from "../lib/eligibility";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync, randomUUID, verify } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { claimStarter } from "../lib/starter/claim";
import {
  canonicalStarterEmail,
  starterIdentity,
} from "../lib/starter/identity";
import { deviceCheckClient } from "../lib/starter/device-check";
import { deviceCheckReason } from "../lib/starter/device-check-response";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const d = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const hashKey =
  "fixture-starter-protection-key-that-is-not-a-production-secret";
const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const owner = (id: string, email = id.slice(0, 1) + "@example.test") =>
  ({
    id,
    email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    identities: [],
    user_metadata: adultEligibilityChoice(),
  }) as unknown as User;

function config() {
  process.env.STARTER_TOKENS_ENABLED = "true";
  process.env.STARTER_TOKEN_HASH_KEY = hashKey;
  process.env.APPLE_DEVICECHECK_KEY_ID = "TESTKEY123";
  process.env.APPLE_DEVICECHECK_PRIVATE_KEY = pem;
}
async function fixture() {
  config();
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz not null default now());create table public.buildly_account_state(user_id uuid primary key references auth.users(id) on delete cascade,deleting_at timestamptz);",
  );
  await db.query(
    "insert into auth.users(id,created_at) values($1,now()-interval '1 day'),($2,now()-interval '1 day')",
    [a, b],
  );
  for (const name of [
    "billing.sql",
    "receipt-fingerprints.sql",
    "starter-tokens.sql",
  ]) {
    await db.exec(
      await readFile(new URL("../supabase/" + name, import.meta.url), "utf8"),
    );
  }
  const rpc = async (name: string, values: object) => {
    assert.match(name, /^siteai_starter_(begin|verify|complete|release)$/);
    try {
      const args = Object.values(values);
      const result = await db.query<{ result: unknown }>(
        `select ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
        args,
      );
      return { data: result.rows[0].result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };
  const client = { rpc } as unknown as SupabaseClient;
  const balance = async (id: string) =>
    (
      await db.query<{ balance: number }>(
        "select balance from buildly_credits where user_id=$1",
        [id],
      )
    ).rows[0]?.balance || 0;
  const seed = async (user: User) => {
    const identity = starterIdentity(user, hashKey);
    return (
      await db.query<{ added: boolean }>(
        "select siteai_starter_seed($1,$2,$3) as added",
        [user.id, identity.account, identity.identities],
      )
    ).rows[0].added;
  };
  return { db, client, balance, seed };
}

test("launch gifts add one token to every existing account, are idempotent and do not become store purchases", async () => {
  const { db, client, balance, seed } = await fixture();
  try {
    await db.query(
      "select buildly_purchase_pack($1,'PRODUCTION:paid-before-launch',2,false)",
      [a],
    );
    assert.equal(await seed(owner(a)), true);
    assert.equal(await seed(owner(b)), true);
    assert.equal(await seed(owner(a)), false);
    assert.equal(await balance(a), 3);
    assert.equal(await balance(b), 1);
    await db.query(
      "insert into auth.users(id,created_at) values($1,now()+interval '1 hour')",
      [c],
    );
    assert.equal(
      await seed(owner(c)),
      false,
      "Future accounts must pass the device check",
    );
    const counts = await db.query<{ count: number }>(
      "select count(*)::int as count from buildly_receipts where user_id=$1 and (transaction_id like 'PRODUCTION:%' or transaction_id like 'SANDBOX:%')",
      [a],
    );
    assert.equal(
      counts.rows[0].count,
      1,
      "Starter grants cannot confirm an unrelated purchase",
    );
    let deviceMarks = 0;
    assert.deepEqual(
      await claimStarter(client, owner(a), "phone-a", {
        used: async () => false,
        markUsed: async () => {
          deviceMarks++;
        },
      }),
      { status: "granted", added: false },
    );
    assert.equal(deviceMarks, 1);
    assert.equal(
      await balance(a),
      3,
      "Linking an existing gift to a device does not add another gift",
    );
  } finally {
    await db.close();
  }
});

test("an unacknowledged account cannot begin device checks or receive a starter token", async () => {
  const { db, client, balance } = await fixture();
  let checks = 0;
  try {
    const user = owner(a);
    user.user_metadata = {};
    await assert.rejects(
      claimStarter(client, user, "fixture", {
        used: async () => {
          checks++;
          return false;
        },
        markUsed: async () => {
          checks++;
        },
      }),
      /18 or older/,
    );
    assert.equal(checks, 0);
    assert.equal(await balance(a), 0);
  } finally {
    await db.close();
  }
});

test("one device gets one new-account gift; replay and recreated email aliases cannot farm tokens", async () => {
  const { db, client, balance } = await fixture();
  try {
    let used = false,
      queries = 0;
    const checker = {
      used: async () => {
        queries++;
        return used;
      },
      markUsed: async () => {
        used = true;
      },
    };
    const alice = owner(a, "Original.Name+first@gmail.com");
    assert.deepEqual(await claimStarter(client, alice, "same-phone", checker), {
      status: "granted",
      added: true,
    });
    assert.deepEqual(await claimStarter(client, alice, "same-phone", checker), {
      status: "granted",
      added: false,
    });
    assert.equal(await balance(a), 1);
    assert.deepEqual(
      await claimStarter(client, owner(b), "same-phone", checker),
      { status: "used" },
    );
    assert.equal(await balance(b), 0);
    await db.query("delete from auth.users where id=$1", [a]);
    await db.query("insert into auth.users(id) values($1)", [d]);
    const before = queries;
    assert.deepEqual(
      await claimStarter(
        client,
        owner(d, "originalname+again@googlemail.com"),
        "another-phone",
        checker,
      ),
      { status: "used" },
    );
    assert.equal(
      queries,
      before,
      "The retained one-way identity prevents deletion/recreation claims on another device",
    );
    assert.equal(await balance(d), 0);
    const records = await db.query<{ user_id: string | null }>(
      "select user_id from siteai_starter_claims where state='granted'",
    );
    assert.equal(
      records.rows[0].user_id,
      null,
      "Deleted accounts retain no readable account link in the claim row",
    );
  } finally {
    await db.close();
  }
});

test("Apple errors never grant a token; a durable verified grant can resume safely", async () => {
  const { db, client, balance } = await fixture();
  try {
    await assert.rejects(
      claimStarter(client, owner(a), "phone", {
        used: async () => false,
        markUsed: async () => {
          throw Error("Apple unavailable");
        },
      }),
    );
    assert.equal(await balance(a), 0);
    const lease = randomUUID(),
      identity = starterIdentity(owner(a), hashKey);
    const begin = (
      await db.query<{ result: { id: string } }>(
        "select siteai_starter_begin($1,$2,$3,$4) as result",
        [a, identity.account, identity.identities, lease],
      )
    ).rows[0].result;
    await assert.rejects(
      db.query("select siteai_starter_complete($1,$2,$3)", [
        a,
        begin.id,
        lease,
      ]),
      /STARTER_NOT_VERIFIED/,
    );
    await db.query("select siteai_starter_verify($1,$2,$3)", [
      a,
      begin.id,
      lease,
    ]);
    await db.query("select siteai_starter_release($1)", [lease]);
    const noApple = {
      used: async () => {
        throw Error("Should not query Apple again");
      },
      markUsed: async () => {
        throw Error("Should not update Apple again");
      },
    };
    assert.deepEqual(
      await claimStarter(client, owner(a), "fresh-token", noApple),
      { status: "granted", added: true },
    );
    assert.equal(await balance(a), 1);
    assert.deepEqual(
      await claimStarter(client, owner(a), "fresh-token", noApple),
      { status: "granted", added: false },
    );
    assert.equal(await balance(a), 1);
  } finally {
    await db.close();
  }
});

test("concurrent starter checks are serialized and clients cannot call the private grant RPCs", async () => {
  const { db, client, balance } = await fixture();
  try {
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = claimStarter(client, owner(a), "phone", {
      used: async () => {
        entered();
        await gate;
        return false;
      },
      markUsed: async () => {},
    });
    await reached;
    await assert.rejects(
      claimStarter(client, owner(b), "phone", {
        used: async () => false,
        markUsed: async () => {},
      }),
      /moment/,
    );
    release();
    await first;
    assert.equal(await balance(a), 1);
    assert.equal(await balance(b), 0);
    for (const role of ["anon", "authenticated"]) {
      const privilege = await db.query<{ ok: boolean }>(
        "select has_function_privilege($1,'siteai_starter_complete(uuid,uuid,uuid)','EXECUTE') as ok",
        [role],
      );
      assert.equal(privilege.rows[0].ok, false);
      const access = await db.query<{ ok: boolean }>(
        "select has_table_privilege($1,'siteai_starter_identities','SELECT') as ok",
        [role],
      );
      assert.equal(access.rows[0].ok, false);
    }
    await db.query("insert into buildly_account_state values($1,now())", [b]);
    assert.equal(
      await (async () => {
        const x = starterIdentity(owner(b), hashKey);
        return (
          await db.query<{ value: boolean }>(
            "select siteai_starter_seed($1,$2,$3) as value",
            [b, x.account, x.identities],
          )
        ).rows[0].value;
      })(),
      false,
    );
  } finally {
    await db.close();
  }
});

test("a free token follows normal reservation, failure recovery and three-revision limits", async () => {
  const { db, client, balance } = await fixture();
  try {
    await claimStarter(client, owner(a), "phone", {
      used: async () => false,
      markUsed: async () => {},
    });
    const reserve = async (id: string, kind: string) =>
      (
        await db.query<{ reservation: string }>(
          "select buildly_reserve($1,$2,$3) as reservation",
          [a, id, kind],
        )
      ).rows[0].reservation;
    const first = await reserve("free-project", "design");
    assert.equal(await balance(a), 0);
    await db.query("select buildly_finish($1,$2,false,null)", [a, first]);
    assert.equal(
      await balance(a),
      1,
      "A failed image releases the free token too",
    );
    const second = await reserve("free-project", "design");
    await db.query("select buildly_finish($1,$2,true,'free-project')", [
      a,
      second,
    ]);
    assert.equal(await balance(a), 0);
    for (let i = 1; i <= 3; i++) {
      const revision = await reserve("free-project", "design");
      await db.query("select buildly_finish($1,$2,true,$3)", [
        a,
        revision,
        `revision-${i}`,
      ]);
    }
    await assert.rejects(reserve("free-project", "design"), /REVISIONS_USED/);
    assert.equal(await balance(a), 0);
  } finally {
    await db.close();
  }
});

test("repeated ineligible checks are capped and an expired lease cannot grant credits", async () => {
  const { db, client, balance } = await fixture();
  try {
    let queries = 0;
    const usedPhone = {
      used: async () => {
        queries++;
        return true;
      },
      markUsed: async () => {
        throw Error("Already used");
      },
    };
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await claimStarter(client, owner(a), "phone", usedPhone)).status,
        "used",
      );
    await assert.rejects(
      claimStarter(client, owner(a), "phone", usedPhone),
      /tomorrow/,
    );
    assert.equal(queries, 5);
    assert.equal(await balance(a), 0);
    const identity = starterIdentity(owner(b), hashKey),
      lease = randomUUID();
    const begin = (
      await db.query<{ result: { id: string } }>(
        "select siteai_starter_begin($1,$2,$3,$4) as result",
        [b, identity.account, identity.identities, lease],
      )
    ).rows[0].result;
    await db.exec(
      "update siteai_starter_mutex set expires_at=now()-interval '1 second'",
    );
    await assert.rejects(
      db.query("select siteai_starter_verify($1,$2,$3)", [b, begin.id, lease]),
      /EXPIRED/,
    );
    assert.equal(await balance(b), 0);
  } finally {
    await db.close();
  }
});

test("device checks sign a valid P-256 JWT, preserve bit 1, and fail closed on unknown replies", async () => {
  config();
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const request = async (
    input: string | URL | Request,
    options?: RequestInit,
  ) => {
    const token = (
      options?.headers as Record<string, string>
    ).Authorization.replace("Bearer ", "");
    const [header, body, signature] = token.split(".");
    assert.equal(
      JSON.parse(Buffer.from(header, "base64url").toString()).kid,
      "TESTKEY123",
    );
    assert.ok(
      verify(
        "sha256",
        Buffer.from(header + "." + body),
        { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64url"),
      ),
    );
    const payload = JSON.parse(String(options?.body));
    calls.push({ path: String(input), body: payload });
    return new Response(
      String(input).endsWith("query_two_bits")
        ? JSON.stringify({ bit0: false, bit1: true })
        : "",
      { status: 200 },
    );
  };
  const client = deviceCheckClient(request as typeof fetch);
  assert.equal(await client.used("opaque-device-token"), false);
  await client.markUsed("opaque-device-token");
  assert.equal(calls[1].body.bit0, true);
  assert.equal("bit1" in calls[1].body, false);
  assert.match(calls[0].path, /^https:\/\/api\.devicecheck\.apple\.com\/v1\//);
  await assert.rejects(
    deviceCheckClient(
      (async () =>
        new Response("unknown response", { status: 200 })) as typeof fetch,
    ).used("token"),
    /could not finish/,
  );
  assert.equal(
    canonicalStarterEmail("First.Last+offer@GoogleMail.com"),
    "firstlast@gmail.com",
  );
});

test("a first device with no saved bit state is eligible and failures expose only controlled diagnostics", async () => {
  config();
  const first = deviceCheckClient(
    (async () =>
      new Response("Bit State Not Found", { status: 200 })) as typeof fetch,
  );
  assert.equal(await first.used("opaque-private-device-token"), false);
  const logs: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...values: unknown[]) => {
    logs.push(values);
  };
  try {
    for (const [body, status, reason] of [
      ["Bad Device Token", 400, "bad_device_token"],
      ["Invalid Authorization Token", 401, "invalid_authorization"],
      ["opaque-private-device-token", 503, "unrecognized_response"],
      ["not-json", 200, "invalid_json"],
      ["null", 200, "invalid_bit_state"],
    ] as const) {
      await assert.rejects(
        deviceCheckClient(
          (async () => new Response(body, { status })) as typeof fetch,
        ).used("opaque-private-device-token"),
        /could not finish/,
      );
      assert.deepEqual(logs.at(-1), [
        "siteai_starter_device_check",
        { stage: "query_two_bits", reason, status },
      ]);
    }
    await assert.rejects(
      deviceCheckClient((async () => {
        throw Error("secret authorization");
      }) as typeof fetch).used("opaque-private-device-token"),
      /could not finish/,
    );
    assert.deepEqual(logs.at(-1), [
      "siteai_starter_device_check",
      { stage: "query_two_bits", reason: "network_failure" },
    ]);
    assert.doesNotMatch(
      JSON.stringify(logs),
      /opaque-private-device-token|secret authorization|Bearer/,
    );
  } finally {
    console.warn = warn;
  }
});

test("compact first-device replies complete one real grant transaction and unknown replies cannot bypass eligibility", async () => {
  const { db, client, balance } = await fixture();
  try {
    let updates = 0;
    const checker = deviceCheckClient((async (url) => {
      if (String(url).endsWith("query_two_bits"))
        return new Response("BitStateNotFound", { status: 200 });
      updates++;
      return new Response("", { status: 200 });
    }) as typeof fetch);
    assert.deepEqual(
      await claimStarter(client, owner(a), "private-device-token", checker),
      { status: "granted", added: true },
    );
    assert.equal(await balance(a), 1);
    assert.deepEqual(
      await claimStarter(client, owner(a), "fresh-device-token", checker),
      { status: "granted", added: false },
    );
    assert.equal(updates, 1);
    assert.equal(await balance(a), 1);
    for (const reply of [
      "Bit State Not Found",
      "BitStateNotFound",
      '"BitStateNotFound"',
      '{"reason":"BitStateNotFound"}',
    ]) {
      assert.equal(
        await deviceCheckClient(
          (async () => new Response(reply, { status: 200 })) as typeof fetch,
        ).used("token"),
        false,
      );
    }
    for (const reply of [
      "No data",
      '{"bit0":1}',
      '{"bit0":true,"reason":"BitStateNotFound"}',
    ]) {
      const check = deviceCheckClient(
        (async () => new Response(reply, { status: 200 })) as typeof fetch,
      );
      if (reply.includes('"bit0":true'))
        assert.equal(await check.used("token"), true);
      else await assert.rejects(check.used("token"), /could not finish/);
    }
    await assert.rejects(
      deviceCheckClient(
        (async () =>
          new Response("BitStateNotFound", { status: 401 })) as typeof fetch,
      ).used("token"),
      /could not finish/,
    );
    assert.equal(deviceCheckReason("BadDeviceToken"), "bad_device_token");
    assert.equal(
      deviceCheckReason("InvalidAuthorizationToken"),
      "invalid_authorization",
    );
  } finally {
    await db.close();
  }
});
