import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { materialAuditIssues } from "../lib/material-audit";
import { materialPurchase } from "../lib/material-purchase";
import { auditMaterials } from "../lib/services/material-audit";
import {
  createDesignPlan,
  type DesignPlan,
  planSchema,
  unavailablePlan,
} from "../lib/services/design-plan";
import { makeDemo } from "../lib/project";
import { DesignError } from "../lib/services/image-design";

const screws = {
  item: "3 in. Exterior Coated Deck Screws (5 lb. Box)",
  quantity: 2,
  quantityFormula: "2 * 1.0",
  quantityUnit: "each",
  unitCost: 32,
  dimensions: "#9 x 3 in.",
  purpose: "Fastening decking and step treads",
  quantityBasis: "Approximate count of 700 fasteners needed for decking",
  purchase: {
    label: "5 lb box",
    coverage: 350,
    wholeUnits: true,
    notes: "Confirm product compatibility.",
  },
};
const corrected = {
  ...screws,
  quantityUnit: "box",
  quantityFormula: "700 / 350",
  purchase: { ...screws.purchase, coverage: 1 },
};
function draft(): DesignPlan {
  return {
    summary: "A deck with railings",
    materials: [structuredClone(screws)],
    tools: ["Drill"],
    steps: Array.from({ length: 6 }, (_, i) => ({
      title: `Phase ${i + 1}`,
      text: "Prepare this part of the deck.",
      actions: ["Mark the layout.", "Check the fit.", "Fasten as specified."],
      materials: [screws.item],
      tools: ["Drill"],
      checks: ["Check the fit."],
      stopConditions: [],
    })),
    assumptions: ["Confirm site dimensions."],
    questions: ["What is the confirmed footprint?"],
    warnings: ["Verify structural connections."],
    laborLow: 8,
    laborHigh: 16,
    crew: 2,
    difficulty: "Intermediate",
  };
}
const success = (data: unknown) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(data) }] },
      },
    ],
  });
test("the reported screw/package mix-up is rejected, while two correctly priced boxes cost $64", () => {
  assert.equal(materialPurchase(screws).total, 11200);
  assert.ok(materialAuditIssues([screws]).some((x) => x.includes("per-piece")));
  assert.equal(materialPurchase(corrected).total, 64);
  assert.deepEqual(materialAuditIssues([corrected]), []);
  assert.deepEqual(
    materialAuditIssues([{ ...corrected, quantity: 200, unitCost: 32 }]),
    [],
    "Large legitimate orders are not blindly price-capped",
  );
  assert.deepEqual(
    materialAuditIssues([
      { ...corrected, item: "Complete hot tub", unitCost: 8000, quantity: 1 },
    ]),
    [],
  );
});
test("a final AI materials audit corrects the draft before any estimated total is published", async () => {
  const image =
    "data:image/jpeg;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "white" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  let plans = 0,
    audits = 0;
  const original = draft();
  const result = await createDesignPlan(
    makeDemo({
      description: "Add railings to the current deck",
      originalImage: image,
      generatedImage: image,
    }),
    {
      apiKey: "fixture-key",
      model: "gemini-2.5-flash",
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.generationConfig.responseSchema.properties.approved) {
          audits++;
          assert.equal(
            body.contents[0].parts.filter(
              (p: { inlineData?: unknown }) => p.inlineData,
            ).length,
            2,
          );
          const prompt = body.contents[0].parts.at(-1).text;
          assert.match(prompt, /FINAL MATERIALS AUDIT/);
          assert.match(prompt, /11200/);
          assert.match(prompt, /Add railings/);
          return success({
            approved: true,
            issues: [],
            corrections: [{ index: 0, material: corrected }],
          });
        }
        plans++;
        return success(original);
      },
    },
  );
  assert.equal(plans, 1);
  assert.equal(audits, 1);
  assert.equal(result.materialsAuditVersion, "unit-price-review-v1");
  assert.equal(materialPurchase(result.materials![0]).total, 64);
  assert.equal(result.estimatedCostLow, 51);
  assert.equal(result.estimatedCostHigh, 90);
  assert.equal(result.materials![0].quantityUnit, "box");
  assert.deepEqual(
    original,
    draft(),
    "Audit patches cannot mutate an already saved version",
  );
});
test("an audit cannot rubber-stamp an outlier, hide its price, rename a material or apply duplicate/foreign rows", async () => {
  for (const output of [
    { approved: true, issues: [], corrections: [] },
    {
      approved: true,
      issues: [],
      corrections: [{ index: 0, material: { ...corrected, unitCost: 0 } }],
    },
    {
      approved: true,
      issues: [],
      corrections: [
        { index: 0, material: { ...corrected, item: "Another product" } },
      ],
    },
    {
      approved: true,
      issues: [],
      corrections: [{ index: 99, material: corrected }],
    },
    {
      approved: true,
      issues: [],
      corrections: [{ index: 0, material: { ...corrected, quantity: 700 } }],
    },
    {
      approved: true,
      issues: [],
      corrections: [
        { index: 0, material: corrected },
        { index: 0, material: corrected },
      ],
    },
    {
      approved: false,
      issues: ["Quantity and package basis conflict"],
      corrections: [],
    },
  ])
    await assert.rejects(
      auditMaterials(makeDemo({}), draft(), {
        apiKey: "fixture-key",
        model: "gemini-2.5-flash",
        parts: [],
        materialSchema: planSchema.properties.materials.items,
        fetcher: async () => success(output),
      }),
      /final materials audit/,
    );
});
test("unknown prices remain unknown and large unrelated products do not trigger ordinary screw guards", () => {
  const each = {
    ...corrected,
    quantity: 700,
    quantityUnit: "each",
    unitCost: 32 / 350,
    purchase: { ...corrected.purchase, coverage: 350 },
  };
  assert.equal(materialPurchase(each).total, 64);
  assert.deepEqual(materialAuditIssues([each]), []);
  assert.ok(
    materialAuditIssues([
      { ...each, purchase: { ...each.purchase, label: "100-count box" } },
    ]).length,
  );
  assert.ok(
    materialAuditIssues([
      { ...corrected, purchase: { ...corrected.purchase, coverage: 350 } },
    ]).length,
  );
});

test("a provider-restricted final audit stops without retrying the blocked input", async () => {
  let requests = 0;
  await assert.rejects(
    auditMaterials(makeDemo({}), draft(), {
      apiKey: "fixture",
      model: "gemini-2.5-flash",
      parts: [],
      materialSchema: planSchema.properties.materials.items,
      fetcher: async () => {
        requests++;
        return Response.json({ promptFeedback: { blockReason: "SAFETY" } });
      },
    }),
    (error) => {
      assert.ok(error instanceof DesignError);
      assert.equal(error.status, 422);
      assert.equal(error.code, "planning_not_processed");
      assert.equal(unavailablePlan(error.message, error).planRetryable, false);
      return true;
    },
  );
  assert.equal(requests, 1);
});
