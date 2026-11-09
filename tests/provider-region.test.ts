import test from "node:test";
import assert from "node:assert/strict";
import { generationUser } from "../lib/production/access";
import { requireProviderRegion } from "../lib/production/provider-region";
import { DesignError } from "../lib/services/image-design";
import { enqueueJob, processQueuedJob } from "../lib/production/job-queue";
import { backgroundFixture, jobId } from "./helpers/background";

const production = { NODE_ENV: "production" };
const request = (country?: string) =>
  new Request("https://site-ai-nomapps.vercel.app/api/jobs?kind=design", {
    method: "POST",
    headers: country ? { "x-vercel-ip-country": country } : {},
    body: JSON.stringify({ country: "US", description: "A bench" }),
  });

test("supported regions include the US, EEA, UK, Switzerland and Kosovo", () => {
  for (const code of ["US", "DE", "GB", "CH", "XK", "CA", "JP", "BR", "IN"])
    assert.doesNotThrow(() => requireProviderRegion(request(code), production));
});

test("the seven unsupported storefront countries cannot start AI work", () => {
  for (const code of ["AF", "BY", "CN", "HK", "MO", "MM", "RU"])
    assert.throws(
      () => requireProviderRegion(request(code), production),
      (error: unknown) =>
        error instanceof DesignError &&
        error.status === 403 &&
        error.code === "ai_region_unavailable",
    );
});

test("a body location cannot replace missing, malformed or unsupported ingress metadata", () => {
  for (const code of [undefined, "XX", "USA", "US,RU", "ZZ"])
    assert.throws(
      () => requireProviderRegion(request(code), production),
      (error: unknown) =>
        error instanceof DesignError && [403, 503].includes(error.status),
    );
  assert.doesNotThrow(() =>
    requireProviderRegion(request(), { NODE_ENV: "development" }),
  );
});

test("unsupported production requests stop before authentication or any account/credit work", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    // Deliberately no authorization header, valid key, or database fixture:
    // a region rejection must happen before any authentication/network call.
    await assert.rejects(
      generationUser(request("RU"), true),
      (error: unknown) =>
        error instanceof DesignError && error.code === "ai_region_unavailable",
    );
    await assert.rejects(
      generationUser(request(), true),
      (error: unknown) =>
        error instanceof DesignError && error.code === "ai_region_unverified",
    );
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("region rejection cannot queue or charge; accepted work finishes after the client leaves", async () => {
  const f = await backgroundFixture();
  const previous = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "true";
  const authorize = f.dependencies.authorize!;
  f.dependencies.authorize = async (req, consent) => {
    requireProviderRegion(req, production);
    return authorize(req, consent);
  };
  const located = (country: string) => {
    const req = f.request();
    req.headers.set("x-vercel-ip-country", country);
    return req;
  };
  try {
    await assert.rejects(
      enqueueJob(located("CN"), "design", () => {}, f.dependencies),
    );
    assert.equal(
      (await f.pg.query("select * from siteai_job_queue")).rows.length,
      0,
    );
    assert.equal(await f.balance(), 2);
    assert.equal(f.calls().designs, 0);
    await enqueueJob(located("US"), "design", () => {}, f.dependencies);
    // The worker uses the accepted durable request, without the phone's headers.
    await processQueuedJob(jobId, f.db, f.dependencies);
    assert.equal(f.calls().designs, 1);
    assert.equal(await f.balance(), 1);
    assert.equal(
      (await f.pg.query<{ state: string }>("select state from buildly_jobs"))
        .rows[0].state,
      "complete",
    );
  } finally {
    await f.pg.close();
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  }
});
