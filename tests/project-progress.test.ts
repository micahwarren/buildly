import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { backgroundFixture, owner, other } from "./helpers/background";
test("plan checkboxes merge atomically, survive reload, protect ownership and leave plan/cost untouched", async () => {
  const f = await backgroundFixture();
  try {
    await f.pg.exec(
      await readFile(
        new URL("../supabase/project-progress.sql", import.meta.url),
        "utf8",
      ),
    );
    const payload = {
      id: "p",
      title: "Shelf",
      steps: [{ title: "Measure" }, { title: "Cut" }, { title: "Fit" }],
      estimatedCostLow: 42,
      materials: [{ item: "Oak" }],
      completed: 0,
    };
    await f.pg.query(
      "insert into projects(id,user_id,payload,updated_at)values($1,$2,$3,now())",
      ["p", owner, payload],
    );
    const mark = async (
      step: number,
      done: boolean,
      user = owner,
      title = payload.steps[step]?.title,
    ) =>
      (
        await f.pg.query<{ v: { completedSteps: number[] } }>(
          "select siteai_project_progress($1,$2,$3,$4,$5)as v",
          [user, "p", step, title, done],
        )
      ).rows[0].v.completedSteps;
    await Promise.all([mark(0, true), mark(2, true)]);
    assert.deepEqual(await mark(2, true), [0, 2]);
    assert.deepEqual(await mark(0, false), [2]);
    const saved = (
      await f.pg.query<{
        payload: typeof payload & { completedSteps: number[] };
      }>("select payload from projects where user_id=$1", [owner])
    ).rows[0].payload;
    assert.deepEqual(saved.completedSteps, [2]);
    assert.deepEqual(saved.steps, payload.steps);
    assert.deepEqual(saved.materials, payload.materials);
    assert.equal(saved.estimatedCostLow, 42);
    await assert.rejects(mark(0, true, other), /PROJECT_NOT_FOUND/);
    await assert.rejects(mark(0, true, owner, "Old plan step"), /PLAN_CHANGED/);
    await assert.rejects(mark(9, true), /PLAN_CHANGED/);
    for (const role of ["anon", "authenticated"])
      assert.equal(
        (
          await f.pg.query<{ ok: boolean }>(
            "select has_function_privilege($1,'siteai_project_progress(uuid,text,integer,text,boolean)','execute')as ok",
            [role],
          )
        ).rows[0].ok,
        false,
      );
    await f.pg.query("update projects set deleted_at=now()where id=$1", ["p"]);
    await assert.rejects(mark(0, true), /PROJECT_NOT_FOUND/);
  } finally {
    await f.pg.close();
  }
});
test("legacy completed prefix is retained and deletion fences prevent progress writes", async () => {
  const f = await backgroundFixture();
  try {
    await f.pg.exec(
      await readFile(
        new URL("../supabase/project-progress.sql", import.meta.url),
        "utf8",
      ),
    );
    await f.pg.query(
      "insert into projects(id,user_id,payload,updated_at)values($1,$2,$3,now())",
      [
        "p",
        owner,
        { steps: [{ title: "One" }, { title: "Two" }], completed: 1 },
      ],
    );
    const r = await f.pg.query<{ v: { completedSteps: number[] } }>(
      "select siteai_project_progress($1,'p',1,'Two',true)as v",
      [owner],
    );
    assert.deepEqual(r.rows[0].v.completedSteps, [0, 1]);
    await f.pg.query("select buildly_begin_deletion($1)", [owner]);
    await assert.rejects(
      f.pg.query("select siteai_project_progress($1,'p',0,'One',false)", [
        owner,
      ]),
      /ACCOUNT_DELETING/,
    );
  } finally {
    await f.pg.close();
  }
});
