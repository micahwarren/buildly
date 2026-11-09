import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { makeDemo as makeProject, type Project } from "../lib/project";
const makeDemo = (input: Partial<Project>) =>
  makeProject({
    description: "A cedar patio beside the existing house",
    ...input,
  });
import { refineProject } from "../lib/services/refine-project";
import { reviewRevisionDesign } from "../lib/services/revision-audit";
import { createDesign } from "../lib/services/image-design";
import { DesignError } from "../lib/services/image-design";
test("a revision edits the current concept without attaching the original site as a competing base", async () => {
  const image = async (color: string) =>
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  const current = await image("red"),
    site = await image("blue"),
    edited = await image("green");
  await createDesign(
    {
      ...makeDemo({ originalImage: "data:image/jpeg;base64," + current }),
      siteImage: "data:image/jpeg;base64," + site,
      refinement: "Add railings",
      previousDescription: "A cedar deck with a built-in bench",
    },
    false,
    {
      provider: "gemini",
      apiKey: "fixture",
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body)),
          parts = body.contents[0].parts;
        const photos = parts.filter(
          (p: { inlineData?: unknown }) => p.inlineData,
        );
        assert.equal(photos.length, 1);
        const a = await sharp(
          Buffer.from(photos[0].inlineData.data, "base64"),
        ).stats();
        assert.ok(a.dominant.r > 200 && a.dominant.b < 50);
        assert.match(parts.at(-1).text, /CURRENT SAVED DESIGN/);
        assert.match(parts.at(-1).text, /A cedar deck with a built-in bench/);
        assert.match(
          parts.at(-1).text,
          /Change only what the latest request explicitly targets/,
        );
        assert.doesNotMatch(parts.at(-1).text, /Add the requested project/);
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { inlineData: { mimeType: "image/jpeg", data: edited } },
                ],
              },
            },
          ],
        });
      },
    },
  );
});
test("revision visual review compares the actual site, prior design and candidate, without claiming engineering approval", async () => {
  const image =
    "data:image/jpeg;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "orange" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  const result = await reviewRevisionDesign(
    makeDemo({ originalImage: image, generatedImage: image }),
    image,
    "Add railings",
    {
      apiKey: "fixture",
      model: "gemini-2.5-flash",
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body)),
          parts = body.contents[0].parts;
        assert.equal(
          parts.filter((p: { inlineData?: unknown }) => p.inlineData).length,
          3,
        );
        assert.match(parts.at(-1).text, /Add railings/);
        assert.match(parts.at(-1).text, /floating\/merged\/broken railings/);
        assert.match(parts.at(-1).text, /Do not certify loads/);
        return Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { text: JSON.stringify({ approved: true, issues: [] }) },
                ],
              },
            },
          ],
        });
      },
    },
  );
  assert.deepEqual(result, { approved: true, issues: [] });
});
test("a visibly defective revision gets one bounded correction from the prior design and saves only the accepted version", async () => {
  const p = makeDemo({
      originalImage: "site",
      generatedImage: "existing-deck",
    }),
    before = structuredClone(p);
  let designs = 0,
    reviews = 0,
    saves = 0,
    plans = 0;
  const result = await refineProject(p, "Add railings", {
    interpret: async () => ({
      description: "Same deck with railings",
      width: p.width,
      length: p.length,
    }),
    design: async (input) => {
      designs++;
      assert.equal(input.originalImage, "existing-deck");
      assert.equal(input.siteImage, undefined);
      assert.equal(input.previousDescription, p.description);
      if (designs === 2)
        assert.deepEqual(input.reviewFeedback, ["Floating rail segment"]);
      return {
        originalImage: input.originalImage,
        generatedImage: designs === 1 ? "bad-preview" : "corrected-preview",
        mode: "ai",
      };
    },
    review: async () => ({
      approved: ++reviews === 2,
      issues: reviews === 1 ? ["Floating rail segment"] : [],
    }),
    onDesign: async (next) => {
      saves++;
      assert.equal(next.generatedImage, "corrected-preview");
    },
    plan: async (next) => {
      plans++;
      assert.equal(next.generatedImage, "corrected-preview");
      return { planStatus: "design-based", materials: [], steps: [] };
    },
  });
  assert.equal(designs, 2);
  assert.equal(reviews, 2);
  assert.equal(saves, 1);
  assert.equal(plans, 1);
  assert.equal(result.parentProjectId, p.id);
  assert.deepEqual(p, before);
});
test("placement/style review receives the homeowner references and only its corrected candidate reaches the plan", async () => {
  const image = async (color: string) =>
    "data:image/jpeg;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  const [site, current, style, material, wrong, corrected] = await Promise.all(
    ["blue", "red", "green", "black", "yellow", "purple"].map(image),
  );
  const project = makeDemo({
    originalImage: site,
    generatedImage: current,
    referenceImages: [style],
    materialImages: [material],
  });
  const original = structuredClone(project);
  const change =
    "Add black vertical-picket railings on the left edge only; keep the stairs open.";
  const issues = [
    "Railings are on the right edge instead of the requested left edge",
    "White solid panels replace the requested black vertical pickets",
  ];
  let edits = 0,
    checks = 0,
    saves = 0,
    plans = 0;
  const result = await refineProject(project, change, {
    interpret: async () => ({
      description: project.description + " " + change,
      width: project.width,
      length: project.length,
    }),
    design: async (input) => {
      edits++;
      assert.equal(input.originalImage, current);
      assert.equal(input.refinement, change);
      assert.deepEqual(input.referenceImages, [style]);
      assert.deepEqual(input.materialImages, [material]);
      assert.deepEqual(input.reviewFeedback, edits === 1 ? [] : issues);
      return {
        originalImage: current,
        generatedImage: edits === 1 ? wrong : corrected,
        mode: "ai",
      };
    },
    review: (prior, candidate, request) =>
      reviewRevisionDesign(prior, candidate, request, {
        apiKey: "fixture",
        model: "gemini-2.5-flash",
        fetcher: async (_url, init) => {
          checks++;
          const parts = JSON.parse(String(init?.body)).contents[0].parts;
          const images = parts.filter(
            (p: { inlineData?: unknown }) => p.inlineData,
          );
          assert.equal(
            images.length,
            5,
            "The reviewer receives the three anchors plus style and finish references",
          );
          assert.ok(
            parts.some((p: { text?: string }) =>
              p.text?.startsWith("INSPIRATION reference"),
            ),
          );
          assert.ok(
            parts.some((p: { text?: string }) =>
              p.text?.startsWith("MATERIAL reference"),
            ),
          );
          const stylePixel = await sharp(
            Buffer.from(images[3].inlineData.data, "base64"),
          ).stats();
          const finishPixel = await sharp(
            Buffer.from(images[4].inlineData.data, "base64"),
          ).stats();
          assert.ok(stylePixel.dominant.g > stylePixel.dominant.r);
          assert.ok(finishPixel.dominant.r < 20 && finishPixel.dominant.g < 20);
          assert.ok(parts.at(-1).text.includes(change));
          return Response.json({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        approved: checks === 2,
                        issues: checks === 1 ? issues : [],
                      }),
                    },
                  ],
                },
              },
            ],
          });
        },
      }),
    onDesign: async (accepted) => {
      saves++;
      assert.equal(accepted.generatedImage, corrected);
    },
    plan: async (accepted) => {
      plans++;
      assert.equal(accepted.generatedImage, corrected);
      return { planStatus: "design-based", materials: [], steps: [] };
    },
  });
  assert.equal(edits, 2);
  assert.equal(checks, 2);
  assert.equal(saves, 1);
  assert.equal(plans, 1);
  assert.equal(result.generatedImage, corrected);
  assert.deepEqual(project, original);
});

test("a rejected visual review without a concrete defect does not authorize a blind image retry", async () => {
  const image =
    "data:image/jpeg;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "white" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  const project = makeDemo({ originalImage: image, generatedImage: image });
  for (const issues of [[], [""], ["   "]]) {
    let edits = 0,
      saves = 0;
    await assert.rejects(
      refineProject(project, "Add railings", {
        interpret: async () => ({
          description: project.description,
          width: project.width,
          length: project.length,
        }),
        design: async () => {
          edits++;
          return { originalImage: image, generatedImage: image, mode: "ai" };
        },
        review: (prior, candidate, change) =>
          reviewRevisionDesign(prior, candidate, change, {
            apiKey: "fixture",
            model: "gemini-2.5-flash",
            fetcher: async () =>
              Response.json({
                candidates: [
                  {
                    finishReason: "STOP",
                    content: {
                      parts: [
                        { text: JSON.stringify({ approved: false, issues }) },
                      ],
                    },
                  },
                ],
              }),
          }),
        onDesign: async () => {
          saves++;
        },
        plan: async () => {
          assert.fail("An unapproved image must not reach planning");
        },
      }),
      (error) =>
        error instanceof DesignError &&
        error.code === "revision_review_unavailable",
    );
    assert.equal(edits, 1);
    assert.equal(saves, 0);
  }
});
test("a revision rejected twice never reaches the saved-image checkpoint or replaces the original", async () => {
  const p = makeDemo({
      originalImage: "site",
      generatedImage: "existing-deck",
    }),
    before = structuredClone(p);
  let designs = 0,
    saves = 0,
    plans = 0;
  await assert.rejects(
    refineProject(p, "Add railings", {
      interpret: async () => ({
        description: "Deck with railings",
        width: p.width,
        length: p.length,
      }),
      design: async () => {
        designs++;
        return {
          originalImage: "existing-deck",
          generatedImage: "bad-preview",
          mode: "ai",
        };
      },
      review: async () => ({
        approved: false,
        issues: ["Door access blocked"],
      }),
      onDesign: async () => {
        saves++;
      },
      plan: async () => {
        plans++;
        return {};
      },
    }),
    /previous version is unchanged/,
  );
  assert.equal(designs, 2);
  assert.equal(saves, 0);
  assert.equal(plans, 0);
  assert.deepEqual(p, before);
});

test("a provider-restricted visual review is not a request to regenerate the same image", async () => {
  const image =
    "data:image/jpeg;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "white" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
  let calls = 0;
  await assert.rejects(
    reviewRevisionDesign(
      makeDemo({ originalImage: image, generatedImage: image }),
      image,
      "Add railings",
      {
        apiKey: "fixture",
        model: "gemini-2.5-flash",
        fetcher: async () => {
          calls++;
          return Response.json({ promptFeedback: { blockReason: "SAFETY" } });
        },
      },
    ),
    (error) => {
      assert.ok(error instanceof DesignError);
      assert.equal(error.code, "image_not_processed");
      assert.equal(error.status, 422);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("successive revisions edit the selected saved version and retain initial and previous instructions", async () => {
  const initial = makeDemo({
    description: "Cedar patio with a built-in bench; preserve the brick house",
    originalImage: "site",
    generatedImage: "current-patio",
  });
  const before = structuredClone(initial);
  const change1 = "Add black railings on the left only",
    change2 = "Make those railings white";
  const inputs: Parameters<typeof createDesign>[0][] = [];
  const revise = async (p: typeof initial, change: string, edited: string) =>
    refineProject(p, change, {
      interpret: async () => ({
        description: "An intentionally terse consolidated summary",
        width: p.width,
        length: p.length,
      }),
      design: async (input) => {
        inputs.push(input);
        return {
          originalImage: input.originalImage,
          generatedImage: edited,
          mode: "ai",
        };
      },
      review: async () => ({ approved: true, issues: [] }),
      plan: async (p) => {
        assert.equal(p.generatedImage, edited);
        return { planStatus: "design-based", materials: [], steps: [] };
      },
    });
  const first = await revise(initial, change1, "black-railing-patio");
  const second = await revise(first, change2, "white-railing-patio");
  assert.equal(inputs[0].originalImage, "current-patio");
  assert.equal(inputs[1].originalImage, "black-railing-patio");
  assert.equal(inputs[1].initialDescription, initial.description);
  assert.deepEqual(inputs[1].revisionInstructions, [change1, change2]);
  assert.deepEqual(second.revisionInstructions, [change1, change2]);
  assert.equal(second.initialDescription, initial.description);
  assert.equal(second.parentProjectId, first.id);
  assert.deepEqual(initial, before);
});

test("a missing saved design or prior scope never falls back to new-project generation", async () => {
  for (const source of [
    makeDemo({ generatedImage: "" }),
    makeDemo({ description: "" }),
  ]) {
    let calls = 0;
    await assert.rejects(
      refineProject(source, "Add rails", {
        interpret: async () => {
          calls++;
          throw Error("must not run");
        },
      }),
      (e) => e instanceof DesignError && e.code === "revision_source_missing",
    );
    assert.equal(calls, 0);
  }
});
