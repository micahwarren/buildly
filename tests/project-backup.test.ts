import test from "node:test";
import assert from "node:assert/strict";
import { parseProjectBackup } from "../lib/project-backup";
import { makeDemo } from "../lib/project";
function fixture() {
  return makeDemo({
    originalImage: "data:image/jpeg;base64,AAAA",
    description: "My family patio",
    projectType: "Patio",
  });
}
test("a backup preserves photos, plan details and completed progress", () => {
  const project = fixture();
  project.completed = 2;
  project.conversation = [{ role: "You", text: "Can I use stone?" }];
  const result = parseProjectBackup(
    JSON.stringify({ format: "buildly-project-v1", project }),
  );
  assert.deepEqual(result, project);
});
test("malformed project structures are rejected before rendering", () => {
  for (const patch of [
    { steps: null },
    { steps: [] },
    { materials: [{}] },
    { projectType: null },
    { completed: 999 },
    { conversation: [null] },
    { createdAt: "invalid" },
  ]) {
    assert.throws(() =>
      parseProjectBackup(
        JSON.stringify({
          format: "buildly-project-v1",
          project: { ...fixture(), ...patch },
        }),
      ),
    );
  }
});
test("backup import rejects executable image URLs and unsupported formats", () => {
  for (const originalImage of [
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "https://untrusted.test/photo",
  ])
    assert.throws(() =>
      parseProjectBackup(
        JSON.stringify({
          format: "buildly-project-v1",
          project: { ...fixture(), originalImage },
        }),
      ),
    );
  assert.throws(() => parseProjectBackup("{}"));
});
