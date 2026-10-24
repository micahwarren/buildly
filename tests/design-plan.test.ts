import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  createDesignPlan,
  validatePlan,
  planFields,
  type DesignPlan,
} from "../lib/services/design-plan";
import { planProject } from "../lib/services/project-planning";
import { makeDemo } from "../lib/project";
function fixture(): DesignPlan {
  return {
    summary:
      "A ground-level paver seating area; the existing wood fence is not part of the work.",
    materials: [
      {
        item: "Concrete pavers",
        quantity: 212,
        dimensions: "Square feet including 10% waste",
        unitCost: 4,
        purpose: "New patio surface",
        quantityBasis: "12 × 16 × 1.10, round up = 212 sq ft",
      },
      {
        item: "Base aggregate",
        quantity: 0,
        dimensions: "Cubic yards; depth needs soil review",
        unitCost: 65,
        purpose: "Support the pavers",
        quantityBasis:
          "Verify depth and drainage design before calculating volume",
      },
    ],
    tools: ["Tape measure", "Plate compactor"],
    steps: Array.from({ length: 8 }, (_, i) => ({
      title: `Patio phase ${i + 1}`,
      text: "Prepare the defined paver area, preserving the existing fence.",
      actions: [
        "Mark the specified rectangular footprint with string.",
        "Measure both diagonals and adjust corners until they match.",
        "Record finished height relative to the threshold and review drainage.",
      ],
      materials: ["Concrete pavers", "Base aggregate"],
      tools: ["Tape measure"],
      checks: ["Both diagonals match before excavation."],
      stopConditions: ["Confirm base depth for local soil before excavation."],
    })),
    assumptions: ["Flat accessible site; soil depth not supplied"],
    questions: ["What soil and drainage conditions are present?"],
    warnings: ["Locate utilities before digging"],
    laborLow: 40,
    laborHigh: 64,
    crew: 2,
    difficulty: "Intermediate — physically demanding",
  };
}
test("planner sends both actual photos, description and structured response schema", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const project = makeDemo({
    originalImage: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    generatedImage: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    description: "Build pavers, preserve the existing fence",
    projectType: "Deck",
    details: { height: "18 inches", location: "Wisconsin" },
  });
  const result = await createDesignPlan(project, {
    apiKey: "test",
    fetcher: async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.equal(
        body.contents[0].parts.filter(
          (p: { inlineData?: unknown }) => p.inlineData,
        ).length,
        2,
      );
      assert.match(
        body.contents[0].parts.at(-1).text,
        /Build pavers, preserve the existing fence/,
      );
      assert.ok(body.generationConfig.responseSchema.properties.steps);
      assert.match(body.contents[0].parts.at(-1).text, /18 inches/);
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify(fixture()) }] },
          },
        ],
      });
    },
  });
  assert.equal(result.planStatus, "design-based");
  assert.equal(result.materials![0].item, "Concrete pavers");
  assert.ok(!result.materials!.some((m) => /deck|screw/i.test(m.item)));
  assert.ok(result.assumptions!.some((a) => a.startsWith("Incomplete cost:")));
});
test("reject incomplete or disconnected material/step plans", () => {
  for (const change of [
    (p: DesignPlan) => {
      p.steps[0].materials = ["Unlisted screws"];
    },
    (p: DesignPlan) => {
      p.steps[0].actions = ["Build it"];
    },
    (p: DesignPlan) => {
      p.materials.push({ ...p.materials[0], item: "Unused lumber" });
    },
    (p: DesignPlan) => {
      p.laborLow = NaN;
    },
    (p: DesignPlan) => {
      p.steps[0].tools = ["Unlisted tool"];
    },
    (p: DesignPlan) => {
      p.materials[0].quantity = -1;
    },
  ]) {
    const p = fixture();
    change(p);
    assert.throws(() => validatePlan(p));
  }
});
test("partial pricing excludes unknown quantities and preserves detailed actions", () => {
  const result = planFields(validatePlan(fixture()));
  assert.equal(result.estimatedCostLow, Math.round(212 * 4 * 0.8));
  assert.equal(result.completed, 0);
  assert.equal(result.steps![0].actions!.length, 3);
});
test("planning failure saves generated image without generic materials or steps", async () => {
  const result = await planProject(
    { description: "Actual custom design" },
    false,
    {
      design: async () => ({
        originalImage: "original",
        generatedImage: "new-design",
        mode: "ai" as const,
      }),
      plan: async () => {
        throw Error("Model unavailable");
      },
    },
  );
  assert.equal(result.generatedImage, "new-design");
  assert.equal(result.planStatus, "unavailable");
  assert.deepEqual(result.materials, []);
  assert.equal(result.steps.length, 1);
  assert.equal(result.planSummary, "Model unavailable");
});
test("new image planning receives that image and returns its associated materials", async () => {
  const result = await planProject({ description: "New pavers" }, false, {
    design: async () => ({
      originalImage: "original",
      generatedImage: "new-patio",
      mode: "ai" as const,
    }),
    plan: async (project) => {
      assert.equal(project.generatedImage, "new-patio");
      return planFields(fixture());
    },
  });
  assert.equal(result.materials[0].item, "Concrete pavers");
});

test("truncated, blocked and provider-error responses cannot become a usable plan", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const project = makeDemo({ originalImage: dataUrl, generatedImage: dataUrl });
  for (const response of [
    Response.json({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [{ text: JSON.stringify(fixture()) }] },
        },
      ],
    }),
    Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
    Response.json({ error: "rate limit" }, { status: 429 }),
    Response.json({
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "not json" }] } },
      ],
    }),
  ])
    await assert.rejects(
      createDesignPlan(project, {
        apiKey: "test",
        fetcher: async () => response,
      }),
    );
});

test("corrects a rejected plan once, retaining both photos and the requested scope", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const image = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  let calls = 0;
  const result = await createDesignPlan(
    makeDemo({
      originalImage: image,
      generatedImage: image,
      description: "A paver seating area",
    }),
    {
      apiKey: "test",
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(init!.body as string);
        assert.equal(
          body.contents[0].parts.filter(
            (p: { inlineData?: unknown }) => p.inlineData,
          ).length,
          2,
        );
        const plan = fixture();
        if (calls === 1) plan.steps[0].materials = ["Unlisted screws"];
        else
          assert.match(
            body.contents[0].parts.at(-1).text,
            /references must match/,
          );
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(plan) }] },
            },
          ],
        });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.planStatus, "design-based");
  assert.equal(result.materials![0].item, "Concrete pavers");
});

test("retries truncated output with a larger output budget but never accepts the truncated plan", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const image = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  let calls = 0;
  const result = await createDesignPlan(
    makeDemo({ originalImage: image, generatedImage: image }),
    {
      apiKey: "test",
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(init!.body as string);
        assert.equal(
          body.generationConfig.maxOutputTokens,
          calls === 1 ? 16000 : 32000,
        );
        return Response.json({
          candidates: [
            {
              finishReason: calls === 1 ? "MAX_TOKENS" : "STOP",
              content: { parts: [{ text: JSON.stringify(fixture()) }] },
            },
          ],
        });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.planStatus, "design-based");
});
