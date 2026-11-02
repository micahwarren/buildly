import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/projects/deletions/route";
test("pending-deletion count requires authentication", async () => {
  const response = await GET(
    new Request("https://buildly.test/api/projects/deletions"),
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("pending-deletion count is owner-scoped even with a foreign user in the query", async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://deletion-fixture.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  let counted = false;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: owner,
        email: "test@example.com",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      });
    assert.equal(url.pathname, "/rest/v1/projects");
    assert.equal(options?.method, "HEAD");
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("deleted_at"), "not.is.null");
    counted = true;
    return new Response(null, {
      status: 200,
      headers: { "Content-Range": "*/2" },
    });
  };
  try {
    const response = await GET(
      new Request(
        `https://buildly.test/api/projects/deletions?user_id=${other}`,
        { headers: { Authorization: "Bearer fixture-token" } },
      ),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { pending: 2 });
    assert.ok(counted);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
