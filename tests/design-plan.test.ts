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
    recommendedMeasurements: [
      {
        label: "Seating clearance",
        value: "Allow 3 feet around seating",
        reason: "Concept allowance; confirm fit on site.",
      },
    ],
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
    audit: async (_project, plan) => plan,
    fetcher: async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.equal(
        body.contents[0].parts.filter(
          (p: { inlineData?: unknown }) => p.inlineData,
        ).length,
        2,
      );
      assert.match(
        body.contents[0].parts
          .map((p: { text?: string }) => p.text || "")
          .join("\n"),
        /Build pavers, preserve the existing fence/,
      );
      assert.ok(body.generationConfig.responseSchema.properties.stepTitles);
      assert.match(JSON.stringify(body.contents[0].parts), /18 inches/);
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
  assert.deepEqual(
    result.recommendedMeasurements,
    fixture().recommendedMeasurements,
  );
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
        audit: async (_project, plan) => plan,
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
      audit: async (_project, plan) => plan,
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
        else {
          assert.equal(body.generationConfig.maxOutputTokens, 32000);
          assert.match(
            body.contents[0].parts.at(-1).text,
            /references must match/,
          );
        }
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
      audit: async (_project, plan) => plan,
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(init!.body as string);
        assert.equal(
          body.generationConfig.maxOutputTokens,
          calls === 1 ? 6000 : 32000,
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

test("staged planning preserves purchased equipment and installation scope across concurrent phases", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const image = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const plan = fixture();
  plan.summary = "Purchase a complete hot tub and build the surrounding deck.";
  plan.materials = [
    {
      item: "Complete ready-made hot tub",
      quantity: 1,
      quantityUnit: "each",
      dimensions: "Manufacturer dimensions to confirm",
      unitCost: 5500,
      purpose: "Purchased spa for the requested installation",
      quantityBasis: "One new unit; provisional midrange purchase allowance",
      purchase: {
        label: "Complete factory-built spa",
        coverage: 1,
        notes: "Confirm model, operating weight and installation requirements.",
      },
    },
    {
      ...plan.materials[0],
      item: "Surrounding deck surface",
      purpose: "DIY deck surrounding the purchased spa",
    },
  ];
  plan.steps = plan.steps.map((step) => ({
    ...step,
    materials: plan.materials.map((material) => material.item),
  }));
  let calls = 0,
    active = 0,
    peak = 0;
  const result = await createDesignPlan(
    makeDemo({
      originalImage: image,
      generatedImage: image,
      description: "Install a hot tub with a surrounding wooden deck",
    }),
    {
      apiKey: "test",
      audit: async (_project, plan) => plan,
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(init!.body as string);
        const instructions = body.contents[0].parts
          .map((part: { text?: string }) => part.text || "")
          .join("\n");
        assert.match(
          instructions,
          /Install a hot tub with a surrounding wooden deck/,
        );
        assert.match(instructions, /complete ready-made product/);
        assert.match(instructions, /never fabrication of the appliance itself/);
        assert.match(instructions, /Preserve real DIY work around the product/);
        assert.match(
          instructions,
          /already owned unless the homeowner says so/,
        );
        assert.equal(
          body.contents[0].parts.filter(
            (p: { inlineData?: unknown }) => p.inlineData,
          ).length,
          2,
        );
        let payload: unknown;
        if (body.generationConfig.responseSchema.properties.stepTitles) {
          const { steps, ...outline } = plan;
          payload = { ...outline, stepTitles: steps.map((s) => s.title) };
        } else {
          const prompt = body.contents[0].parts.at(-1).text;
          const range = /Expand ONLY phases (\d+)–(\d+)/.exec(prompt)!;
          assert.ok(range);
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 10));
          active--;
          payload = {
            steps: plan.steps.slice(Number(range[1]) - 1, Number(range[2])),
          };
        }
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(payload) }] },
            },
          ],
        });
      },
    },
  );
  assert.equal(calls, 4);
  assert.equal(peak, 3);
  assert.equal(result.planStatus, "design-based");
  assert.deepEqual(result.steps, plan.steps);
  assert.deepEqual(result.materials, plan.materials);
  assert.equal(result.materials![0].quantity, 1);
  assert.equal(result.materials![0].unitCost, 5500);
  assert.equal(result.estimatedCostLow, Math.round((5500 + 212 * 4) * 0.8));
});

test("harmless reference formatting is canonicalized, while different products remain invalid", () => {
  const plan = fixture();
  plan.steps[0].materials = ["  concrete   PAVERS ", "Base aggregate"];
  plan.steps[0].tools = ["tape measure"];
  const result = validatePlan(plan);
  assert.deepEqual(result.steps[0].materials, [
    "Concrete pavers",
    "Base aggregate",
  ]);
  assert.deepEqual(result.steps[0].tools, ["Tape measure"]);
  const different = fixture();
  different.steps[0].materials = ["Concrete pavers 2 inch"];
  assert.throws(() => validatePlan(different), /phase 1: material references/);
});

test("a malformed instruction section is repaired without discarding the accepted catalog or other phases", async () => {
  const bytes = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const image = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const plan = fixture();
  const sections = new Map<number, number>();
  let outlines = 0;
  const result = await createDesignPlan(
    makeDemo({ originalImage: image, generatedImage: image }),
    {
      apiKey: "test",
      audit: async (_project, plan) => plan,
      fetcher: async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        let payload;
        if (body.generationConfig.responseSchema.properties.stepTitles) {
          outlines++;
          const { steps, ...outline } = plan;
          payload = { ...outline, stepTitles: steps.map((s) => s.title) };
        } else {
          const prompt = body.contents[0].parts.at(-1).text;
          const range = /Expand ONLY phases (\d+)–(\d+)/.exec(prompt)!;
          const first = Number(range[1]),
            count = (sections.get(first) || 0) + 1;
          sections.set(first, count);
          const props =
            body.generationConfig.responseSchema.properties.steps.items
              .properties;
          assert.deepEqual(
            props.materials.items.enum,
            plan.materials.map((m) => m.item),
          );
          assert.deepEqual(props.tools.items.enum, plan.tools);
          assert.equal(props.actions.minItems, 3);
          assert.equal(props.checks.minItems, 1);
          const steps = structuredClone(
            plan.steps.slice(first - 1, Number(range[2])),
          );
          if (first === 1 && count === 1)
            steps[0].actions = ["Incomplete action"];
          if (first === 1 && count === 2) {
            assert.match(prompt, /Correct this section only/);
            assert.match(prompt, /needs 3–12 concrete actions/);
            assert.equal(body.generationConfig.maxOutputTokens, 10000);
          }
          payload = { steps };
        }
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(payload) }] },
            },
          ],
        });
      },
    },
  );
  assert.equal(outlines, 1);
  assert.deepEqual([...sections.values()], [2, 1, 1]);
  assert.deepEqual(result.materials, plan.materials);
  assert.deepEqual(result.steps, plan.steps);
  assert.equal(result.estimatedCostLow, Math.round(212 * 4 * 0.8));
});

test("recommendations preserve design-specific guidance and reject malformed model values", () => {
  const plan = fixture();
  assert.deepEqual(
    planFields(validatePlan(plan)).recommendedMeasurements,
    plan.recommendedMeasurements,
  );
  assert.throws(() =>
    validatePlan({
      ...plan,
      recommendedMeasurements: [
        { label: "Width", value: 12, reason: "A guess" },
      ],
    }),
  );
});

test("AI project names come from the existing plan without replacing names during a plan-only retry", async () => {
  const plan = { ...fixture(), projectTitle: "Courtyard Paver Patio" };
  const fields = planFields(validatePlan(plan));
  assert.equal(fields.suggestedTitle, "Courtyard Paver Patio");
  assert.equal(
    fields.title,
    undefined,
    "Plan-only fields must not overwrite a homeowner's saved name",
  );
  const result = await planProject({ description: "A paver patio" }, false, {
    design: async () => ({
      originalImage: "source",
      generatedImage: "design",
      mode: "ai" as const,
    }),
    plan: async () => fields,
  });
  assert.equal(result.title, "Courtyard Paver Patio");
  assert.equal(
    planFields({ ...plan, projectTitle: "x".repeat(200) }).suggestedTitle,
    undefined,
  );
});
