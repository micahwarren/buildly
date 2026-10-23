import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateProject } from "../lib/estimates";
import { makeDemo } from "../lib/project";
const estimate = (
  type = "Deck",
  width = 12,
  length = 16,
  experienceLevel = "Experienced",
) => estimateProject({ projectType: type, width, length, experienceLevel });
test("deck quantities include actual board width, waste and dedicated fasteners", () => {
  const e = estimate();
  assert.equal(
    e.materials.find((m) => m.item === "Pressure-treated decking")?.quantity,
    Math.ceil((192 * 1.1) / (5.5 / 12)),
  );
  for (const name of [
    "Exterior decking screws",
    "Connector nails / structural connector screws",
    "Post bases and anchors",
  ])
    assert.ok(e.materials.find((m) => m.item === name)!.quantity > 0);
  assert.equal(e.difficulty, "Advanced");
});
test("size, project type and experience change labor; cost reconciles with line items", () => {
  const e = estimate(),
    large = estimate("Deck", 20, 30),
    beginner = estimate("Deck", 12, 16, "Beginner");
  assert.ok(parseInt(large.estimatedHours) > parseInt(e.estimatedHours));
  assert.ok(parseInt(beginner.estimatedHours) > parseInt(e.estimatedHours));
  assert.notEqual(estimate("Pergola").estimatedHours, e.estimatedHours);
  const subtotal = e.materials.reduce(
    (sum, m) => sum + m.quantity * m.unitCost,
    0,
  );
  assert.equal(e.estimatedCostLow, Math.round(subtotal * 0.8));
  assert.equal(e.estimatedCostHigh, Math.round(subtotal * 1.4));
});
test("patio base uses volume conversion; fence uses run length only", () => {
  const p = estimate("Patio");
  assert.equal(
    p.materials.find((m) => m.item === "Aggregate base")?.quantity,
    Math.ceil(((192 * 0.5) / 27) * 1.2 * 10),
  );
  assert.deepEqual(estimate("Fence", 12, 16), estimate("Fence", 40, 16));
});
test("all supported types have finite positive quantities and scope assumptions", () => {
  for (const type of ["Deck", "Pergola", "Patio", "Fence", "Shed"])
    for (const [w, l] of [
      [1, 1],
      [12, 16],
      [100, 200],
    ]) {
      const e = estimate(type, w, l);
      assert.ok(e.materials.length >= 7);
      assert.ok(
        e.materials.every(
          (m) =>
            Number.isFinite(m.quantity) && m.quantity > 0 && m.unitCost > 0,
        ),
      );
      assert.ok(
        e.assumptions.some((a) =>
          a.startsWith("Time is a planning allowance:"),
        ),
      );
    }
});
test("custom scope does not fabricate a materials estimate; generation uses calculator", () => {
  assert.equal(estimate("Something else").materials.length, 0);
  const p = makeDemo({
    projectType: "Pergola",
    width: 12,
    length: 16,
    experienceLevel: "Experienced",
  });
  assert.equal(p.estimatedHours, estimate("Pergola").estimatedHours);
  assert.equal(p.recommendedCrew, "3 people total");
});
