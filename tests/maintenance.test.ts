import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/maintenance/route";

test("scheduled cleanup rejects missing/wrong credentials without reaching the database", async () => {
  const previous = process.env.BUILDLY_MAINTENANCE_TOKEN;
  process.env.BUILDLY_MAINTENANCE_TOKEN = "fixture-maintenance-secret";
  try {
    for (const authorization of [undefined, "Bearer wrong-token"]) {
      const response = await GET(
        new Request("https://buildly.test/api/maintenance", {
          headers: authorization ? { authorization } : {},
        }),
      );
      assert.equal(response.status, 401);
    }
  } finally {
    if (previous === undefined) delete process.env.BUILDLY_MAINTENANCE_TOKEN;
    else process.env.BUILDLY_MAINTENANCE_TOKEN = previous;
  }
});

test("authenticated cron performs cleanup and retains uncleaned failed-image history", async () => {
  const keys = [
    "BUILDLY_MAINTENANCE_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const previousFetch = globalThis.fetch;
  const calls: { method: string; url: URL }[] = [];
  process.env.BUILDLY_MAINTENANCE_TOKEN = "fixture-maintenance-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://maintenance-fixture.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  globalThis.fetch = async (input, options) => {
    calls.push({
      method: options?.method || "GET",
      url: new URL(String(input)),
    });
    return Response.json([]);
  };
  try {
    const response = await GET(
      new Request("https://buildly.test/api/maintenance", {
        headers: { authorization: "Bearer fixture-maintenance-secret" },
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      complete: 0,
      pending: 0,
      failedUploads: 0,
    });
    const prune = calls.find(
      (call) =>
        call.method === "DELETE" && call.url.pathname.endsWith("/buildly_jobs"),
    );
    assert.ok(prune);
    assert.equal(prune.url.searchParams.get("result_id"), "is.null");
    assert.equal(
      prune.url.searchParams.get("or"),
      "(kind.eq.plan,failure_code.eq.files_cleaned)",
    );
    assert.ok(
      calls.some(
        (call) =>
          call.method === "DELETE" &&
          call.url.pathname.endsWith("/buildly_diagnostics"),
      ),
    );
    assert.ok(
      calls.some(
        (call) =>
          call.method === "PATCH" &&
          call.url.pathname.endsWith("/buildly_jobs"),
      ),
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
