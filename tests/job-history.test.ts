import test from "node:test";
import assert from "node:assert/strict";
import { GET, DELETE } from "../app/api/jobs/route";

test("request history preserves server retries, reports released credits and owner-scopes dismissal", async () => {
  const previous = {
    fetch: globalThis.fetch,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://history-fixture.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-key";
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const id = "11111111-1111-4111-8111-111111111111";
  let working = true,
    dismissed = false,
    direct = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: owner,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      });
    const table = url.pathname.split("/rest/v1/")[1];
    if (table === "buildly_jobs") {
      assert.equal(url.searchParams.get("user_id"), "eq." + owner);
      if (init?.method === "PATCH") {
        assert.equal(url.searchParams.get("state"), "in.(failed,interrupted)");
        dismissed = true;
        return Response.json([{ id }]);
      }
      if (!direct)
        assert.equal(url.searchParams.get("dismissed_at"), "is.null");
      return Response.json(
        dismissed && !direct
          ? []
          : [
              {
                id,
                state: "failed",
                kind: "design",
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() - 1000).toISOString(),
                result_id: null,
              },
            ],
      );
    }
    if (table === "siteai_job_queue")
      return Response.json(working ? [{ job_id: id, status: "queued" }] : []);
    if (table === "buildly_reservations") {
      assert.equal(url.searchParams.get("user_id"), "eq." + owner);
      return Response.json([{ request_id: id, state: "released" }]);
    }
    throw Error("Unexpected fixture route " + url.pathname);
  };
  const req = (query: string) =>
    new Request("https://fixture.test/api/jobs?" + query, {
      headers: { Authorization: "Bearer fixture-token" },
    });
  try {
    let response = await GET(req("summary=1&user_id=foreign"));
    let value = await response.json();
    assert.equal(
      value.jobs[0].state,
      "running",
      "a transient failed attempt is still building while the durable queue retries",
    );
    assert.equal(value.jobs[0].charged, false);
    assert.equal(
      (await DELETE(req("id=" + id))).status,
      409,
      "active retries cannot be dismissed",
    );
    working = false;
    response = await GET(req("summary=1"));
    value = await response.json();
    assert.equal(value.jobs[0].state, "failed");
    assert.equal((await DELETE(req("id=" + id))).status, 200);
    assert.deepEqual((await (await GET(req("summary=1"))).json()).jobs, []);
    direct = true;
    assert.equal(
      (await GET(req("id=" + id))).status,
      200,
      "dismissal never makes an existing operation look unsent",
    );
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  }
});
