import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { executeJob } from "../lib/production/jobs";
import { generationUser } from "../lib/production/access";
import { makeDemo, type Project } from "../lib/project";
import { DesignError } from "../lib/services/image-design";
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const jobs = new Map<string, Record<string, unknown>>(),
    projects = new Map<string, Project>(),
    files = new Map<string, Uint8Array>();
  let calls = 0;
  const bytes = await sharp({
    create: { width: 30, height: 60, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  const photo = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const db = createClient("https://fixture.test", "test-service-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method || "GET";
        const json = (value: unknown, status = 200) =>
          Response.json(value, { status });
        const failure = (message: string) =>
          json({ message, code: "P0001", details: null, hint: null }, 400);
        if (url.pathname.endsWith("/rpc/buildly_claim_job")) {
          const data = JSON.parse(String(init!.body));
          const job = jobs.get(data.p_id);
          if (job) {
            if (job.user_id !== data.p_user) return failure("JOB_NOT_FOUND");
            if (job.request_hash !== data.p_hash)
              return failure("JOB_CONFLICT");
            return json({ claimed: false, job });
          }
          const value = {
            id: data.p_id,
            user_id: data.p_user,
            request_hash: data.p_hash,
            state: "running",
          };
          jobs.set(data.p_id, value);
          return json({ claimed: true, job: value });
        }
        if (url.pathname === "/rest/v1/projects") {
          const id = url.searchParams.get("id")?.replace("eq.", "");
          if (method === "POST") {
            const data = JSON.parse(String(init!.body));
            projects.set(data.id, data.payload);
            return json(null);
          }
          return json(
            projects.has(id || "") ? { payload: projects.get(id!) } : null,
          );
        }
        if (url.pathname === "/rest/v1/buildly_jobs" && method === "PATCH") {
          const id = url.searchParams.get("id")!.replace("eq.", "");
          Object.assign(jobs.get(id)!, JSON.parse(String(init!.body)));
          return json(null);
        }
        if (url.pathname.startsWith("/storage/v1/object/project-images/")) {
          const path = url.pathname.slice(
            "/storage/v1/object/project-images/".length,
          );
          if (method === "POST") {
            files.set(
              path,
              new Uint8Array(
                await new Response(init!.body as BodyInit).arrayBuffer(),
              ),
            );
            return json({ Key: path });
          }
          const content = files.get(path);
          if (!content) return new Response(null, { status: 404 });
          return new Response(content as BodyInit, {
            headers: { "Content-Type": "image/jpeg" },
          });
        }
        throw Error(`Unexpected fixture request ${method} ${url.pathname}`);
      },
    },
  });
  const authorize = (async () => ({
    db,
    user: {
      id: user,
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
      user_metadata: { ai_consent_version: "2026-10-29:gemini" },
    },
  })) as typeof generationUser;
  const design: NonNullable<
    Parameters<typeof executeJob>[3]
  >["design"] = async (input, _demo, dependencies) => {
    calls++;
    const p = makeDemo({
      ...input,
      originalImage: photo,
      generatedImage: photo,
      demo: false,
    });
    await dependencies?.onDesign?.(p);
    assert.equal(
      projects.get(p.id)?.planStatus,
      "unavailable",
      "Image is durable before planning finishes",
    );
    return {
      ...p,
      visualizationMode: "ai" as const,
      planStatus: "design-based",
      title: "Saved design",
    };
  };
  const request = (body: object = {}, id = key) =>
    new Request("https://buildly.test/api/jobs?kind=design", {
      method: "POST",
      headers: { "Idempotency-Key": id },
      body: JSON.stringify({
        originalImage: photo,
        description: "A white door",
        ...body,
      }),
    });
  return {
    db,
    authorize,
    design,
    request,
    projects,
    jobs,
    files,
    calls: () => calls,
    photo,
  };
}
test("lost-response retries return the durable result without another image, with private image references", async () => {
  const f = await fixture();
  const result = await executeJob(f.request(), "design", true, {
    authorize: f.authorize,
    design: f.design,
  });
  assert.equal(result.state, "complete");
  assert.ok(result.project!.generatedImage.startsWith(`storage:${user}/`));
  assert.equal(f.jobs.get(key)?.state, "complete");
  const replay = await executeJob(f.request(), "design", true, {
    authorize: f.authorize,
    design: f.design,
  });
  assert.equal(replay.project!.id, key);
  assert.equal(f.calls(), 1);
  await assert.rejects(
    executeJob(
      f.request({ description: "Different request" }),
      "design",
      true,
      { authorize: f.authorize, design: f.design },
    ),
    (e) => e instanceof DesignError && e.status === 409,
  );
  const unauthorized = (async () => ({
    db: f.db,
    user: {
      id: other,
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
      user_metadata: {},
    },
  })) as typeof generationUser;
  await assert.rejects(
    executeJob(f.request(), "design", true, {
      authorize: unauthorized,
      design: f.design,
    }),
    (e) => e instanceof DesignError && e.status === 404,
  );
  assert.equal(f.calls(), 1);
});
test("missing plans reuse the owned image and preserve names; failures preserve the saved design", async () => {
  const f = await fixture();
  await executeJob(f.request(), "design", true, {
    authorize: f.authorize,
    design: f.design,
  });
  f.projects.set(key, {
    ...f.projects.get(key)!,
    title: "Renamed door",
    planStatus: "unavailable",
  });
  const retry = (id: string) =>
    new Request("https://buildly.test/api/jobs?kind=plan", {
      method: "POST",
      headers: { "Idempotency-Key": id },
      body: JSON.stringify({ id: key }),
    });
  const result = await executeJob(
    retry("22222222-2222-4222-8222-222222222222"),
    "plan",
    true,
    {
      authorize: f.authorize,
      plan: async (p) => {
        assert.ok(p.generatedImage.startsWith("data:image/jpeg;"));
        return { planStatus: "design-based", planSummary: "Recovered plan" };
      },
    },
  );
  assert.equal(result.project!.title, "Renamed door");
  assert.equal(result.project!.planSummary, "Recovered plan");
  assert.equal(f.calls(), 1);
  await assert.rejects(
    executeJob(retry("33333333-3333-4333-8333-333333333333"), "plan", true, {
      authorize: f.authorize,
      plan: async () => {
        throw new DesignError("Fixture planning failure", 504);
      },
    }),
    /Fixture planning failure/,
  );
  assert.equal(f.projects.get(key)?.title, "Renamed door");
  assert.equal(
    f.jobs.get("33333333-3333-4333-8333-333333333333")?.state,
    "failed",
  );
});
test("requests fail closed before generation and malformed bodies are rejected", async () => {
  const f = await fixture();
  const denied = (async () => {
    throw new DesignError("Sign in to continue.", 401);
  }) as typeof generationUser;
  await assert.rejects(
    executeJob(f.request(), "design", true, {
      authorize: denied,
      design: f.design,
    }),
    (e) => e instanceof DesignError && e.status === 401,
  );
  assert.equal(f.calls(), 0);
});
