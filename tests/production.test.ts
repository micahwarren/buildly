import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { requireRecentLogin } from "../lib/production/access";
import { jobError } from "../lib/production/errors";
const alice = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  bob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture() {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table public.projects(id text,user_id uuid references auth.users(id),payload jsonb);alter table projects enable row level security;grant usage on schema auth to authenticated;grant select on projects to authenticated;",
  );
  await db.exec(
    "create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant insert,update on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;grant insert,update on projects to authenticated;",
  );
  await db.query("insert into auth.users values($1),($2)", [alice, bob]);
  const sql = await readFile(
    new URL("../supabase/production.sql", import.meta.url),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  return db;
}
test("durable operation claims are idempotent, private and shared across retries", async () => {
  const db = await fixture();
  try {
    const claim = async (
      user: string,
      n: number,
      hash = "same",
      daily = 20,
      global = 200,
    ) =>
      (
        await db.query<{
          result: { claimed: boolean; job: { state: string } };
        }>("select buildly_claim_job($1,$2,'design',null,$3,$4,$5) as result", [
          user,
          id(n),
          hash,
          daily,
          global,
        ])
      ).rows[0].result;
    assert.equal((await claim(alice, 1)).claimed, true);
    assert.equal((await claim(alice, 1)).claimed, false);
    await assert.rejects(claim(bob, 1), /JOB_NOT_FOUND/);
    await assert.rejects(claim(alice, 1, "different"), /JOB_CONFLICT/);
    await assert.rejects(claim(alice, 2), /REQUEST_IN_PROGRESS/);
    await db.query(
      "update buildly_jobs set state='complete',result_id='saved-project' where id=$1",
      [id(1)],
    );
    const replay = await claim(alice, 1);
    assert.equal(replay.claimed, false);
    assert.equal(replay.job.state, "complete");
    assert.equal((await claim(alice, 2)).claimed, true);
    await db.query(
      "update buildly_jobs set expires_at=now()-interval '1 minute' where id=$1",
      [id(2)],
    );
    assert.equal((await claim(alice, 2)).job.state, "interrupted");
    assert.equal((await claim(alice, 3)).claimed, true);
  } finally {
    await db.close();
  }
});
test("limits permit an initial design and three revisions, then enforce account and service limits", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into projects(id,user_id,payload) values('parent',$1,'{}'),('parent',$2,'{}')",
      [alice, bob],
    );
    const claim = (user: string, n: number, daily = 20, global = 200) =>
      db.query(
        "select buildly_claim_job($1,$2,'refine','parent','hash',$3,$4)",
        [user, id(n), daily, global],
      );
    for (let i = 1; i <= 6; i++) {
      await claim(alice, i);
      await db.query("update buildly_jobs set state='complete' where id=$1", [
        id(i),
      ]);
    }
    await assert.rejects(claim(alice, 7), /SHORT_LIMIT/);
    await db.exec("update buildly_jobs set created_at=now()-interval '1 hour'");
    await assert.rejects(claim(alice, 8, 6), /DAILY_LIMIT/);
    await assert.rejects(claim(bob, 9, 20, 6), /SERVICE_LIMIT/);
  } finally {
    await db.close();
  }
});
test("account deletion excludes in-flight work and prevents new requests", async () => {
  const db = await fixture();
  try {
    await db.query("select buildly_claim_job($1,$2,'design',null,'hash')", [
      alice,
      id(1),
    ]);
    await assert.rejects(
      db.query("select buildly_begin_deletion($1)", [alice]),
      /REQUEST_IN_PROGRESS/,
    );
    await db.exec("update buildly_jobs set state='complete'");
    await db.query("select buildly_begin_deletion($1)", [alice]);
    await assert.rejects(
      db.query("select buildly_claim_job($1,$2,'design',null,'hash')", [
        alice,
        id(2),
      ]),
      /ACCOUNT_DELETING/,
    );
    await db.query("delete from auth.users where id=$1", [alice]);
    assert.equal((await db.query("select * from buildly_jobs")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("project tombstones are hidden and rows remain isolated between users", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into projects(id,user_id,payload,deleted_at) values('alice',$1,'{}',null),('deleted',$1,'{}',now()),('bob',$2,'{}',null)",
      [alice, bob],
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    assert.deepEqual(
      (await db.query<{ id: string }>("select id from projects")).rows.map(
        (r) => r.id,
      ),
      ["alice"],
    );
    await assert.rejects(
      db.query("select buildly_claim_job($1,$2,'design',null,'hash')", [
        alice,
        id(1),
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from buildly_jobs"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("account deletion requires a fresh login and diagnostics do not expose database errors", () => {
  assert.throws(() => requireRecentLogin({}), /confirm your password/);
  assert.throws(
    () =>
      requireRecentLogin({
        last_sign_in_at: new Date(Date.now() - 360000).toISOString(),
      }),
    /confirm your password/,
  );
  requireRecentLogin({ last_sign_in_at: new Date().toISOString() });
  assert.equal(jobError("JOB_NOT_FOUND secret").status, 404);
  assert.equal(jobError("DAILY_LIMIT").status, 429);
  assert.doesNotMatch(
    jobError("postgres password secret").message,
    /postgres|password|secret/,
  );
});
test("project deletion is serialized with generation and diagnostic reports are bounded", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into projects(id,user_id,payload) values('parent',$1,'{}')",
      [alice],
    );
    await db.query("select buildly_claim_job($1,$2,'refine','parent','hash')", [
      alice,
      id(5),
    ]);
    await assert.rejects(
      db.query("select buildly_mark_project_deleted($1,'parent')", [alice]),
      /REQUEST_IN_PROGRESS/,
    );
    await db.exec("update buildly_jobs set state='complete'");
    await db.query("select buildly_mark_project_deleted($1,'parent')", [alice]);
    await assert.rejects(
      db.query("select buildly_claim_job($1,$2,'refine','parent','hash')", [
        alice,
        id(6),
      ]),
      /PROJECT_NOT_FOUND/,
    );
    for (let i = 0; i < 12; i++)
      await db.query(
        "select buildly_report_diagnostic($1,'screen_error','ios','1.0.0 (9)',$2)",
        [alice, "a".repeat(64)],
      );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from buildly_diagnostics",
        )
      ).rows[0].count,
      10,
    );
  } finally {
    await db.close();
  }
});

test("private image paths reject cross-account access, traversal and URL injection", async () => {
  const { ownedImagePath } = await import("../lib/production/projects");
  assert.equal(
    ownedImagePath(`storage:${alice}/project-1/original-abc.jpg`, alice),
    `${alice}/project-1/original-abc.jpg`,
  );
  for (const value of [
    `storage:${bob}/project-1/image.jpg`,
    `storage:${alice}/../image.jpg`,
    `storage:${alice}/project/..`,
    `storage:${alice}/project/image.jpg?token=bad`,
    `storage:${alice}/project%2f../image.jpg`,
    `storage:${alice}/project/image#fragment.jpg`,
  ])
    assert.throws(() => ownedImagePath(value, alice));
});

test("deletion fences reject new client photos, project writes and tombstone resurrection", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into projects(id,user_id,payload) values('saved',$1,'{}')",
      [alice],
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    await db.exec("set role authenticated");
    await db.query("insert into storage.objects values('project-images',$1)", [
      `${alice}/saved/photo.jpg`,
    ]);
    await assert.rejects(
      db.query("insert into storage.objects values('project-images',$1)", [
        `${bob}/saved/photo.jpg`,
      ]),
      /row-level security/,
    );
    await db.exec("reset role");
    await db.query("select buildly_mark_project_deleted($1,'saved')", [alice]);
    await db.exec("set role authenticated");
    const hidden = await db.query(
      "update projects set deleted_at=null where id='saved' returning id",
    );
    assert.equal(hidden.rows.length, 0);
    await db.exec("reset role");
    await db.query("select buildly_begin_deletion($1)", [alice]);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("insert into storage.objects values('project-images',$1)", [
        `${alice}/new/photo.jpg`,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into projects(id,user_id,payload) values('new',$1,'{}')",
        [alice],
      ),
      /row-level security/,
    );
    await db.exec("reset role");
    await db.query("delete from projects where user_id=$1", [alice]);
    await db.query("delete from auth.users where id=$1", [alice]);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("insert into storage.objects values('project-images',$1)", [
        `${alice}/after-deletion/photo.jpg`,
      ]),
      /row-level security/,
    );
  } finally {
    await db.close();
  }
});
