import { adultEligibilityChoice } from "../lib/eligibility";
import test from "node:test";
import assert from "node:assert/strict";
import { createClient, type User } from "@supabase/supabase-js";
import { consentVersion, generationAccount } from "../lib/production/access";
import { DesignError } from "../lib/services/image-design";

test("generation requires renewed consent for the current disclosure and provider", async () => {
  const previous = {
    provider: process.env.IMAGE_PROVIDER,
    enabled: process.env.SIGHTSAW_GENERATION_ENABLED,
  };
  process.env.IMAGE_PROVIDER = "gemini";
  process.env.SIGHTSAW_GENERATION_ENABLED = "true";
  let reads = 0;
  const db = createClient("https://fixture.test", "fixture-service", {
    auth: { persistSession: false },
    global: {
      fetch: async () => {
        reads++;
        return Response.json([]);
      },
    },
  });
  const user: User = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  try {
    for (const acknowledgement of [{}, { adult_eligibility: false }, { ...adultEligibilityChoice(), adult_eligibility_version: "old" }]) {
      user.user_metadata = { ...acknowledgement, ai_consent_version: `${consentVersion}:gemini` };
      await assert.rejects(generationAccount({ db, user }, true),
        (error: unknown) => error instanceof DesignError && error.status === 403 && error.code === "adult_eligibility_required");
    }
    assert.equal(reads, 0, "AI permission alone cannot bypass adult eligibility");
    for (const consent of [undefined, null, "2026-10-29:gemini", `${consentVersion}:openai`]) {
      user.user_metadata = { ...adultEligibilityChoice(), ai_consent_version: consent };
      await assert.rejects(
        generationAccount({ db, user }, true),
        (error: unknown) => error instanceof DesignError && error.status === 403,
      );
    }
    assert.equal(reads, 0, "Rejected permissions cannot reach account work or generation");
    user.user_metadata = { ...adultEligibilityChoice(), ai_consent_version: `${consentVersion}:gemini` };
    assert.equal((await generationAccount({ db, user }, true)).user.id, user.id);
    assert.equal(reads, 1);
    user.user_metadata = { ...adultEligibilityChoice(), ai_consent_version: null };
    await assert.rejects(generationAccount({ db, user }, true));
    assert.equal(reads, 1, "Revocation stops later generation requests");
  } finally {
    if (previous.provider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.SIGHTSAW_GENERATION_ENABLED;
    else process.env.SIGHTSAW_GENERATION_ENABLED = previous.enabled;
  }
});
