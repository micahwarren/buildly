import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/health/route";

test("health reports the same generation pause flag precedence as real requests", async () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "IMAGE_PROVIDER",
    "SIGHTSAW_GENERATION_ENABLED",
    "BUILDLY_GENERATION_ENABLED",
  ];
  const before = names.map((n) => process.env[n]),
    previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://health-fixture.test",
    SUPABASE_SERVICE_ROLE_KEY: "private-service-fixture",
    GEMINI_API_KEY: "private-image-fixture",
    IMAGE_PROVIDER: "gemini",
  });
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    for (const [current, legacy, expected] of [
      ["false", "true", false],
      ["true", "false", true],
      [undefined, "false", false],
    ] as const) {
      if (current === undefined) delete process.env.SIGHTSAW_GENERATION_ENABLED;
      else process.env.SIGHTSAW_GENERATION_ENABLED = current;
      process.env.BUILDLY_GENERATION_ENABLED = legacy;
      const body = await (await GET()).json();
      assert.equal(body.generationEnabled, expected);
      assert.equal(body.service, "site-ai");
      assert.equal(body.status, expected ? "ok" : "degraded");
      assert.equal(JSON.stringify(body).includes("private-"), false);
    }
  } finally {
    globalThis.fetch = previousFetch;
    names.forEach((n, i) => {
      if (before[i] === undefined) delete process.env[n];
      else process.env[n] = before[i];
    });
  }
});
