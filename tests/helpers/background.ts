import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { makeDemo } from "../../lib/project";
import type { JobDependencies } from "../../lib/production/jobs";
export const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  jobId = "11111111-1111-4111-8111-111111111111";
export async function backgroundFixture() {
  const pg = new PGlite();
  await pg.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.projects(id text,user_id uuid references auth.users(id) on delete cascade,payload jsonb,updated_at timestamptz,primary key(user_id,id));alter table projects enable row level security;grant usage on schema auth to authenticated;grant select,insert,update on projects to authenticated;create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant insert,update on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;",
  );
  for (const file of [
    "billing.sql",
    "production.sql",
    "background-jobs.sql",
    "project-notifications.sql",
  ])
    await pg.exec(
      await readFile(
        new URL("../../supabase/" + file, import.meta.url),
        "utf8",
      ),
    );
  await pg.query("insert into auth.users values($1),($2)", [owner, other]);
  await pg.query("select buildly_purchase_pack($1,'SANDBOX:fixture',2,false)", [
    owner,
  ]);
  const bytes = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const photo = "data:image/jpeg;base64," + bytes.toString("base64");
  const files = new Map<string, Uint8Array>();
  let designs = 0,
    plans = 0;
  const user = {
    id: owner,
    email: "test@example.test",
    email_confirmed_at: new Date().toISOString(),
    aud: "authenticated",
    app_metadata: {},
    user_metadata: { ai_consent_version: "2026-10-29:gemini" },
    created_at: new Date().toISOString(),
  };
  const tables = new Set([
    "projects",
    "buildly_jobs",
    "buildly_account_state",
    "siteai_job_queue",
    "siteai_push_devices",
    "siteai_push_outbox",
  ]);
  const db = createClient("https://fixture.test", "fixture-service-role-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method || "GET";
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        try {
          if (url.pathname.startsWith("/auth/v1/admin/users/"))
            return json(user);
          if (url.pathname.includes("/rpc/")) {
            const fn = url.pathname.split("/rpc/")[1];
            if (!/^(siteai_|buildly_)[a-z_]+$/.test(fn))
              throw Error("Unexpected RPC");
            const values = Object.values(JSON.parse(String(init?.body)));
            const out = await pg.query<{ value: unknown }>(
              `select ${fn}(${values.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
              values,
            );
            return json(
              fn === "siteai_claim_push"
                ? out.rows.map((r) => r.value)
                : (out.rows[0]?.value ?? null),
            );
          }
          if (url.pathname.startsWith("/storage/v1/object/project-images/")) {
            const name = decodeURIComponent(
              url.pathname.split("/project-images/")[1],
            );
            if (method === "POST") {
              files.set(
                name,
                new Uint8Array(
                  await new Response(init?.body as BodyInit).arrayBuffer(),
                ),
              );
              return json({ Key: name });
            }
            const body = files.get(name);
            return body
              ? new Response(body as BodyInit, {
                  headers: { "Content-Type": "image/jpeg" },
                })
              : new Response(null, { status: 404 });
          }
          const table = url.pathname.split("/rest/v1/")[1];
          if (!tables.has(table)) throw Error("Unexpected table " + table);
          const values: unknown[] = [];
          const where: string[] = [];
          for (const [name, value] of url.searchParams) {
            if (["select", "order", "limit", "on_conflict"].includes(name))
              continue;
            if (!/^[a-z_]+$/.test(name)) throw Error("Unexpected filter");
            if (value.startsWith("eq.")) {
              values.push(value.slice(3));
              where.push(`${name}=$${values.length}`);
            } else if (value === "is.null") where.push(`${name} is null`);
            else if (value === "not.is.null") where.push(`${name} is not null`);
            else if (value.startsWith("lte.") || value.startsWith("gte.")) {
              values.push(value.slice(4));
              where.push(
                `${name}${value.startsWith("lte") ? "<=" : ">="}$${values.length}`,
              );
            } else if (value.startsWith("in.(")) {
              const list = value.slice(4, -1).split(",");
              const at = values.length;
              values.push(...list);
              where.push(
                `${name} in(${list.map((_, i) => "$" + (at + i + 1)).join(",")})`,
              );
            } else throw Error("Unexpected filter value " + value);
          }
          const filter = where.length ? " where " + where.join(" and ") : "";
          if (method === "PATCH") {
            const data = JSON.parse(String(init?.body));
            const pairs = Object.entries(data).map(([name, value]) => {
              if (!/^[a-z_]+$/.test(name)) throw Error("Bad column");
              values.push(value);
              return `${name}=$${values.length}`;
            });
            await pg.query(
              `update ${table} set ${pairs.join(",")}${filter}`,
              values,
            );
            return json(null);
          }
          if (method === "POST" && table === "projects") {
            const data = JSON.parse(String(init?.body));
            await pg.query(
              "insert into projects(id,user_id,payload,updated_at,deleted_at) values($1,$2,$3,$4,$5) on conflict(user_id,id)do update set payload=excluded.payload,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at",
              [
                data.id,
                data.user_id,
                data.payload,
                data.updated_at,
                data.deleted_at,
              ],
            );
            return json(null);
          }
          if (method === "GET") {
            const select = url.searchParams.get("select") || "*";
            if (!/^[a-z_*,]+$/.test(select)) throw Error("Bad select");
            const result = await pg.query(
              `select ${select} from ${table}${filter}`,
              values,
            );
            return json(result.rows);
          }
          throw Error("Unexpected request " + method);
        } catch (e) {
          return json({ code: "P0001", message: (e as Error).message }, 400);
        }
      },
    },
  });
  const dependencies: JobDependencies = {
    authorize: async () => ({ db, user }),
    design: async (input, _demo, options) => {
      designs++;
      const p = makeDemo({
        ...input,
        originalImage: photo,
        generatedImage: photo,
        demo: false,
      });
      await options?.onDesign?.(p);
      return { ...p, planStatus: "design-based" };
    },
    plan: async () => {
      plans++;
      return {
        planStatus: "design-based",
        materials: makeDemo({ originalImage: photo }).materials,
        steps: makeDemo({ originalImage: photo }).steps,
        planSummary: "Matching plan",
      };
    },
  };
  const request = (id = jobId) =>
    new Request("https://fixture.test/api/jobs?kind=design", {
      method: "POST",
      headers: { "idempotency-key": id },
      body: JSON.stringify({
        originalImage: photo,
        description: "A simple bench",
      }),
    });
  const balance = async () =>
    Number(
      (
        await pg.query<{ balance: number }>(
          "select balance from buildly_credits where user_id=$1",
          [owner],
        )
      ).rows[0].balance,
    );
  return {
    pg,
    db,
    user,
    dependencies,
    request,
    balance,
    photo,
    files,
    calls: () => ({ designs, plans }),
  };
}
