import test from "node:test";
import assert from "node:assert/strict";
import { backgroundFixture, owner, other } from "./helpers/background";
import {
  projectHistory,
  orderedVersions,
} from "../lib/production/project-history";
import { GET } from "../app/api/projects/history/route";
test("history returns all owned versions in creation order without duplicating projects, writes, or credit charges", async () => {
  const f = await backgroundFixture();
  try {
    for (const [id, parent, date, user] of [
      ["original", undefined, "2026-11-01T00:00:00Z", owner],
      ["revision-1", "original", "2026-11-02T00:00:00Z", owner],
      ["revision-2", "revision-1", "2026-11-03T00:00:00Z", owner],
      ["foreign", undefined, "2026-11-04T00:00:00Z", other],
      ["unrelated", undefined, "2026-11-05T00:00:00Z", owner],
    ] as const)
      await f.pg.query(
        "insert into projects(id,user_id,payload,updated_at)values($1,$2,$3,$4)",
        [
          id,
          user,
          {
            id,
            parentProjectId: parent,
            title: id,
            createdAt: date,
            generatedImage: "private-image",
            materials: [{ item: id }],
          },
          date,
        ],
      );
    const before = await f.pg.query(
      "select * from buildly_credits order by user_id",
    );
    const versions = await projectHistory(f.db, owner, "revision-2");
    assert.deepEqual(
      versions.versions.map((v) => v.id),
      ["original", "revision-1", "revision-2"],
    );
    assert.deepEqual(
      versions.versions.map((v) => v.label),
      ["Original", "Revision 1", "Revision 2"],
    );
    assert.equal(versions.latestId, "revision-2");
    assert.equal(
      (await projectHistory(f.db, owner, "original")).latestId,
      "revision-2",
    );
    assert.deepEqual(
      (await f.pg.query("select * from buildly_credits order by user_id")).rows,
      before.rows,
    );
    await assert.rejects(
      projectHistory(f.db, owner, "foreign"),
      /could not be found/,
    );
    await f.pg.query(
      "update projects set deleted_at=now()where id='revision-1'",
    );
    assert.equal(
      (await projectHistory(f.db, owner, "original")).versions.some(
        (v) => v.id === "revision-1",
      ),
      false,
    );
    assert.equal(
      (
        await GET(
          new Request(
            "https://example.test/api/projects/history?id=original&user_id=" +
              owner,
          ),
        )
      ).status,
      401,
    );
  } finally {
    await f.pg.close();
  }
});
test("version sorting survives missing parents and cycles and does not let renamed timestamps make the original newest", () => {
  const v = (
    id: string,
    parentProjectId: string | undefined,
    createdAt: string,
  ) => ({ id, parentProjectId, createdAt, image: "" });
  assert.deepEqual(
    orderedVersions(
      [
        v("r2", "r1", "2026-01-01"),
        v("root", undefined, "2026-02-01"),
        v("r1", "root", "2026-01-01"),
      ],
      "root",
    ).map((x) => x.id),
    ["root", "r1", "r2"],
  );
  assert.equal(
    orderedVersions([v("a", "b", ""), v("b", "a", "")], "missing").length,
    2,
  );
});
