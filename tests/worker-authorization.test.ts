import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { workerAuthorization } from "../lib/production/worker-authorization";
test("worker requires a fresh signature bound to its nonce; no bearer credential travels through the transport", () => {
  const secret="fixture-worker-key", now=Date.now(), sent=String(Math.floor(now/1000)), nonce=randomUUID();
  const headers=new Headers({"x-siteai-time":sent,"x-siteai-nonce":nonce,"x-siteai-signature":createHmac("sha256",secret).update(sent+"."+nonce).digest("hex")});
  assert.deepEqual(workerAuthorization(headers,secret,now),{nonce,sent:Number(sent)});
  assert.equal(workerAuthorization(headers,secret,now+121000),null);
  assert.equal(workerAuthorization(headers,"wrong-key",now),null);
  headers.set("x-siteai-nonce",randomUUID());assert.equal(workerAuthorization(headers,secret,now),null);
  assert.equal(workerAuthorization(new Headers({authorization:"Bearer "+secret}),secret,now),null);
});
test("worker nonce is atomically consumed once, with no client access or stale replays", async () => {
  const pg=new PGlite();
  try {
    await pg.exec("create role anon;create role authenticated;create role service_role;");
    await pg.exec(await readFile(new URL("../supabase/background-worker-auth.sql",import.meta.url),"utf8"));
    const nonce=randomUUID(),sent=Math.floor(Date.now()/1000);
    const run=()=>pg.query<{ok:boolean}>("select siteai_worker_once($1,$2)as ok",[nonce,sent]);
    const results=await Promise.all([run(),run()]);
    assert.deepEqual(results.map(r=>r.rows[0].ok).sort(),[false,true]);
    assert.equal((await pg.query<{ok:boolean}>("select siteai_worker_once($1,$2)as ok",[randomUUID(),sent-121])).rows[0].ok,false);
    for(const role of ['anon','authenticated'])
      assert.equal((await pg.query<{ok:boolean}>("select has_function_privilege($1,'siteai_worker_once(uuid,bigint)','EXECUTE')as ok",[role])).rows[0].ok,false);
  } finally {await pg.close();}
});
