import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { backgroundFixture, owner, other } from "./helpers/background";
test("catalog shows one latest card per revision family, preserves independent projects and pages families", async () => {
  const f = await backgroundFixture();
  try {
    const add = async (
      id: string,
      parent: string | undefined,
      date: string,
      user = owner,
    ) =>
      f.pg.query(
        "insert into projects(id,user_id,payload,updated_at)values($1,$2,$3,$4)",
        [
          id,
          user,
          {
            id,
            title: id,
            parentProjectId: parent,
            createdAt: date,
            planStatus: "design-based",
          },
          date,
        ],
      );
    await add("root", undefined, "2026-11-01T00:00:00.000Z");
    await add("r1", "root", "2026-11-02T00:00:00.000Z");
    await add("r2", "r1", "2026-11-03T00:00:00.000Z");
    await add("separate", undefined, "2026-11-04T00:00:00.000Z");
    await add("private-other", undefined, "2026-11-05T00:00:00.000Z", other);
    await f.pg.query(
      "update projects set updated_at='2026-11-06' where id='root'and user_id=$1",
      [owner],
    );
    const catalog = async (limit = 20, offset = 0, id: string | null = null) =>
      (
        await f.pg.query<{
          value: {
            total: number;
            projects: {
              id: string;
              familyId: string;
              familyMembers: string[];
            }[];
          };
        }>("select siteai_project_catalog($1,$2,$3,$4)as value", [
          owner,
          limit,
          offset,
          id,
        ])
      ).rows[0].value;
    const result = await catalog();
    assert.equal(result.total, 2);
    assert.deepEqual(
      result.projects.map((p) => p.id),
      ["separate", "r2"],
    );
    assert.deepEqual(result.projects[1].familyMembers, ["r1", "r2", "root"]);
    assert.equal(result.projects[1].familyId, "root");
    assert.equal((await catalog(1, 1)).projects[0].id, "r2");
    assert.equal((await catalog(20, 0, "root")).projects[0].id, "r2");
    assert.equal((await catalog(20, 0, "private-other")).projects.length, 0);
    const job = randomUUID();
    await f.pg.query(
      "insert into buildly_jobs(id,user_id,kind,source_id,request_hash)values($1,$2,'refine','r1','fixture')",
      [job, owner],
    );
    await assert.rejects(
      f.pg.query("select siteai_mark_family_deleted($1,'r2')", [owner]),
      /REQUEST_IN_PROGRESS/,
    );
    assert.equal((await catalog()).total, 2);
    await f.pg.query("update buildly_jobs set state='complete'where id=$1", [
      job,
    ]);
    const marked = await f.pg.query<{ ids: string[] }>(
      "select siteai_mark_family_deleted($1,'r2')as ids",
      [owner],
    );
    assert.deepEqual(marked.rows[0].ids.sort(), ["r1", "r2", "root"]);
    assert.equal((await catalog()).total, 1);
    assert.equal(
      (
        await f.pg.query(
          "select * from projects where user_id=$1 and deleted_at is null",
          [other],
        )
      ).rows.length,
      1,
    );
    assert.deepEqual(
      (
        await f.pg.query<{ ids: string[] }>(
          "select siteai_mark_family_deleted($1,'private-other')as ids",
          [owner],
        )
      ).rows[0].ids,
      [],
    );
    for (const role of ["anon", "authenticated"])
      for (const fn of [
        "siteai_project_lineage(uuid)",
        "siteai_project_catalog(uuid,integer,integer,text)",
        "siteai_mark_family_deleted(uuid,text)",
      ])
        assert.equal(
          (
            await f.pg.query<{ ok: boolean }>(
              "select has_function_privilege($1,$2,'EXECUTE')as ok",
              [role, fn],
            )
          ).rows[0].ok,
          false,
        );
  } finally {
    await f.pg.close();
  }
});
test("paid root mappings survive missing ancestors and malformed cycles cannot hang the catalog", async () => {
  const f = await backgroundFixture();
  try {
    for (const [id, parent] of [
      ["a", "b"],
      ["b", "a"],
      ["child", "missing-parent"],
    ])
      await f.pg.query(
        "insert into projects(id,user_id,payload,updated_at)values($1,$2,$3,now())",
        [id, owner, { id, parentProjectId: parent, title: id }],
      );
    await f.pg.query(
      "insert into buildly_project_access(id,user_id,root_id)values('child',$1,'original-paid-root')",
      [owner],
    );
    const rows = (
      await f.pg.query<{ id: string; family_id: string }>(
        "select id,family_id from siteai_project_lineage($1)",
        [owner],
      )
    ).rows;
    assert.equal(
      rows.find((r) => r.id === "child")?.family_id,
      "original-paid-root",
    );
    assert.equal(
      rows.find((r) => r.id === "a")?.family_id,
      rows.find((r) => r.id === "b")?.family_id,
    );
    const result = (
      await f.pg.query<{ value: { total: number } }>(
        "select siteai_project_catalog($1)as value",
        [owner],
      )
    ).rows[0].value;
    assert.equal(result.total, 2);
  } finally {
    await f.pg.close();
  }
});
