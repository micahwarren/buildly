import test from "node:test";
import assert from "node:assert/strict";
import { materialPurchase } from "../lib/material-purchase";
import { quantityFormula } from "../lib/quantity-formula";
import {
  planFields,
  validatePlan,
  type DesignPlan,
} from "../lib/services/design-plan";

test("takeoff arithmetic includes waste and unit conversions exactly once", () => {
  assert.equal(quantityFormula("13 * 14 * 1.10"), 200.2);
  assert.equal(quantityFormula("13 × 14 × 1.10"), 200.2);
  assert.equal(quantityFormula("64 * (4 / 12) / 27 * 1.15"), 0.908642);
  assert.equal(quantityFormula("168 / (5.5 / 12) * 1.1"), 403.2);
});
test("quantity math rejects code, mixed units, implicit concatenation and unbounded expressions", () => {
  for (const text of [
    "1 2",
    "1. 5",
    "1 / 0",
    "-1",
    "1000001",
    "1 + process.exit()",
    "Math.ceil(1.2)",
    "10%",
    "12 ft",
    "2(3)",
    "2**3",
    "(".repeat(18) + "1" + ")".repeat(18),
  ])
    assert.throws(() => quantityFormula(text));
});
test("discrete package prices include the full number of boxes and boards", () => {
  const screws = materialPurchase({
    quantity: 800,
    quantityUnit: "each",
    unitCost: 0.08,
    purchase: { label: "350-count box", coverage: 350, wholeUnits: true },
  });
  assert.equal(screws.count, 3);
  assert.equal(screws.packagePrice, 28);
  assert.equal(screws.total, 84);
  const boards = materialPurchase({
    quantity: 200.2,
    quantityUnit: "linear ft",
    unitCost: 1.15,
    purchase: { label: "14 ft board", coverage: 14 },
  });
  assert.equal(boards.count, 15);
  assert.equal(boards.packagePrice, 16.1);
  assert.equal(boards.total, 241.5);
});
test("measured bulk stays fractional and unknown prices never become free", () => {
  for (const wholeUnits of [undefined, false]) {
    const bulk = materialPurchase({
      quantity: 1.25,
      quantityUnit: "cubic yard",
      unitCost: 65,
      purchase: { label: "Bulk delivered aggregate", coverage: 1, wholeUnits },
    });
    assert.equal(bulk.count, 1.25);
    assert.equal(bulk.total, 81.25);
  }
  assert.equal(materialPurchase({ quantity: 0, unitCost: 10 }).total, null);
  assert.equal(materialPurchase({ quantity: 1, unitCost: 0 }).total, null);
  assert.equal(materialPurchase({ quantity: 2, unitCost: 12 }).total, 24);
  assert.equal(
    materialPurchase({ quantity: 1e308, unitCost: 1e308 }).total,
    null,
  );
});
test("the saved budget uses calculated takeoff and rounded stock purchases", () => {
  const material = {
    item: "Framing stock",
    quantity: 182,
    quantityFormula: "13*14*1.10",
    quantityUnit: "linear ft",
    dimensions: "14 ft stock; section to verify",
    unitCost: 1.15,
    purpose: "Provisional framing",
    quantityBasis: "13 concept runs, 14 feet each, plus 10% waste",
    purchase: {
      label: "14 ft board",
      coverage: 14,
      wholeUnits: true,
      notes: "Confirm continuous cuts and structural requirements.",
    },
  };
  const plan: DesignPlan = {
    summary: "Concept platform",
    materials: [material],
    tools: ["Tape"],
    assumptions: ["Concept dimensions"],
    questions: [],
    warnings: ["Verify design"],
    laborLow: 10,
    laborHigh: 20,
    crew: 2,
    difficulty: "Intermediate",
    steps: Array.from({ length: 6 }, (_, i) => ({
      title: `Phase ${i + 1}`,
      text: "Prepare the agreed design.",
      actions: ["Measure", "Mark", "Check"],
      materials: [material.item],
      tools: ["Tape"],
      checks: ["Confirm layout"],
      stopConditions: [],
    })),
  };
  const result = planFields(validatePlan(plan));
  assert.equal(result.materials![0].quantity, 200.2);
  assert.equal(result.estimatedCostLow, Math.round(241.5 * 0.8));
  assert.equal(result.estimatedCostHigh, Math.round(241.5 * 1.4));
  assert.equal(result.estimateBasisVersion, "purchase-packages-v1");
});
