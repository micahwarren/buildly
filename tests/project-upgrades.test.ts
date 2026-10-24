import test from "node:test";
import assert from "node:assert/strict";
import { requestGemini } from "../lib/services/gemini-request";
import { answerProjectQuestion } from "../lib/services/project-qa";
import {
  interpretRefinement,
  refineProject,
} from "../lib/services/refine-project";
import { parseDetails } from "../lib/project-details";
import { makeDemo } from "../lib/project";
import { packageCount, shoppingLine, validShopping } from "../lib/shopping";
import { reviewFindings, reviewPacket } from "../lib/plan-review";
import { parseProjectBackup } from "../lib/project-backup";
const success = (value: unknown) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
const base = () =>
  makeDemo({
    projectType: "Patio",
    description: "Wooden patio and pergola",
    originalImage: "data:image/jpeg;base64,AAAA",
    generatedImage: "data:image/jpeg;base64,BBBB",
    width: 12,
    length: 16,
    details: { material: "Cedar", attachment: "Freestanding" },
  });
test("an unavailable default model triggers discovery, not another image purchase", async () => {
  const urls: string[] = [];
  const result = await requestGemini(
    [],
    {},
    {
      apiKey: "test",
      fetcher: async (url) => {
        urls.push(String(url));
        if (urls.length === 1)
          return Response.json(
            { error: { status: "NOT_FOUND" } },
            { status: 404 },
          );
        if (urls.length === 2)
          return Response.json({
            models: [
              {
                name: "models/gemini-3.8-flash-image",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-3.8-flash",
                supportedGenerationMethods: ["generateContent"],
              },
            ],
          });
        return Response.json({ ok: true });
      },
    },
  );
  assert.deepEqual(result, { ok: true });
  assert.match(urls[2], /gemini-3.8-flash:generateContent/);
});
test("pinned model and permission errors are actionable and never leak provider secrets", async () => {
  let calls = 0;
  await assert.rejects(
    requestGemini(
      [],
      {},
      {
        apiKey: "test",
        model: "chosen-model",
        fetcher: async () => {
          calls++;
          return Response.json(
            { error: { message: "secret-key-here", status: "NOT_FOUND" } },
            { status: 404 },
          );
        },
      },
    ),
    (error) =>
      error instanceof Error &&
      /404.*chosen-model/.test(error.message) &&
      !/secret-key-here/.test(error.message),
  );
  assert.equal(calls, 1);
});
test("schema rejection retries JSON mode with the same specification", async () => {
  const bodies: Record<string, unknown>[] = [];
  await requestGemini(
    [],
    {
      responseSchema: { type: "OBJECT" },
      responseMimeType: "application/json",
    },
    {
      apiKey: "test",
      fetcher: async (_url, init) => {
        bodies.push(JSON.parse(init!.body as string));
        return bodies.length === 1
          ? Response.json(
              {
                error: {
                  message: "response_schema exceeds supported complexity",
                  status: "INVALID_ARGUMENT",
                },
              },
              { status: 400 },
            )
          : Response.json({ ok: true });
      },
    },
  );
  assert.equal(
    (bodies[1].generationConfig as Record<string, unknown>).responseSchema,
    undefined,
  );
  assert.match(
    JSON.stringify(bodies[1].contents),
    /conforming exactly to this schema/,
  );
});
test("real chat carries scope, site answers, current step and history", async () => {
  const project = base();
  project.conversation = [{ role: "You", text: "Keep the existing fence" }];
  const result = await answerProjectQuestion(
    "How should I mark the corners?",
    project,
    {
      apiKey: "test",
      fetcher: async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        const prompt = body.contents[0].parts[0].text;
        assert.match(prompt, /Wooden patio and pergola/);
        assert.match(prompt, /Freestanding/);
        assert.match(prompt, /Keep the existing fence/);
        assert.match(prompt, /currentStep/);
        return success({
          answer:
            "Mark the footprint using string, then compare both diagonals before digging.",
        });
      },
    },
  );
  assert.match(result, /diagonals/);
});
test("refinement updates dimensions and stores a separate version while clearing stale quotes and approvals", async () => {
  const project = base();
  const before = structuredClone(project);
  const result = await refineProject(project, "Make it two feet wider", {
    interpret: async () => ({
      description: "14 × 16 wooden patio and pergola",
      width: 14,
      length: 16,
    }),
    design: async (input, _demo, options) => {
      assert.equal(input.originalImage, project.generatedImage);
      assert.equal(input.width, 14);
      assert.equal(options?.timeoutMs, 150000);
      return {
        originalImage: input.originalImage,
        generatedImage: "new-image",
        mode: "ai",
      };
    },
    plan: async (input) => {
      assert.equal(input.originalImage, project.originalImage);
      assert.equal(input.generatedImage, "new-image");
      return { planStatus: "design-based", planSummary: "Updated request" };
    },
  });
  assert.notEqual(result.id, project.id);
  assert.equal(result.parentProjectId, project.id);
  assert.equal(result.width, 14);
  assert.deepEqual(project, before);
  assert.deepEqual(result.shopping, []);
  assert.equal(result.review, undefined);
});
test("ambiguous refinement asks a question instead of generating a guessed design", async () => {
  await assert.rejects(
    interpretRefinement(base(), "Make it bigger", {
      apiKey: "test",
      fetcher: async () =>
        success({
          description: "unchanged",
          width: 12,
          length: 16,
          clarification: "What width and length would you like?",
        }),
    }),
    /What width/,
  );
});
test("shopping rounds packages up and keeps unknown quantities out of quoted totals", () => {
  assert.equal(packageCount(212, 100), 3);
  assert.equal(packageCount(0, 100), null);
  assert.equal(packageCount(100, 0), null);
  const line = shoppingLine(
    { item: "Screws", quantity: 212, dimensions: "each", unitCost: 0.1 },
    {
      item: "Screws",
      packageLabel: "100-count box",
      coverage: 100,
      price: 12.5,
      supplier: "Local store",
      url: "https://example.com/product",
      purchased: false,
      updatedAt: new Date().toISOString(),
    },
  );
  assert.equal(line.total, 37.5);
  assert.equal(
    validShopping([
      {
        item: "screws",
        coverage: 1,
        price: 1,
        packageLabel: "box",
        supplier: "x",
        url: "javascript:alert(1)",
        purchased: false,
        updatedAt: new Date().toISOString(),
      },
    ]),
    false,
  );
});
test("review detects the reported wood/paver mismatch and escapes exported user text", () => {
  const project = base();
  assert.ok(reviewFindings(project).some((f) => /scope mismatch/.test(f)));
  project.description = '<script>alert("bad")</script>';
  const packet = reviewPacket(project);
  assert.doesNotMatch(packet, /<script>/);
  assert.match(packet, /&lt;script&gt;/);
  assert.match(packet, /No review recorded/);
});
test("details and shopping survive backup validation; invalid additions fail", () => {
  assert.deepEqual(
    parseDetails({ material: " Cedar ", arbitrary: "ignored" }),
    { material: "Cedar" },
  );
  assert.throws(() => parseDetails({ height: 4 }));
  const project = base();
  assert.deepEqual(
    parseProjectBackup(
      JSON.stringify({ format: "buildly-project-v1", project }),
    ).details,
    project.details,
  );
  assert.throws(() =>
    parseProjectBackup(
      JSON.stringify({
        format: "buildly-project-v1",
        project: { ...project, review: { reviewer: null } },
      }),
    ),
  );
});
