import test, { before } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createDesign, DesignError } from "../lib/services/image-design";
import { planProject } from "../lib/services/project-planning";
let source: Buffer;
let edited: Buffer;
let input: {
  originalImage: string;
  projectType: string;
  description: string;
  width: number;
  length: number;
};
before(async () => {
  source = await sharp({
    create: { width: 320, height: 200, channels: 3, background: "#888888" },
  })
    .jpeg()
    .toBuffer();
  edited = await sharp({
    create: { width: 1536, height: 1024, channels: 3, background: "#557744" },
  })
    .jpeg()
    .toBuffer();
  input = {
    originalImage: `data:image/jpeg;base64,${source.toString("base64")}`,
    projectType: "Patio",
    description: "A stone patio by the back door, without changing the house",
    width: 12,
    length: 16,
  };
});
test("missing key returns setup error; never substitutes a sample", async () => {
  await assert.rejects(
    createDesign(input, false, { apiKey: "" }),
    (e) => e instanceof DesignError && e.status === 503,
  );
});
test("explicit demo mode returns an identified illustration", async () => {
  const result = await createDesign(input, true, { apiKey: "" });
  assert.equal(result.mode, "demo");
  assert.equal(result.generatedImage, "/images/patio.svg");
});
test("real path attaches the actual photo to image edits, includes the idea, and preserves source dimensions", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/images/edits");
    assert.equal(options?.method, "POST");
    const form = options?.body as FormData;
    assert.equal(form.get("model"), "gpt-image-1.5");
    assert.equal(form.get("input_fidelity"), "high");
    const file = form.get("image") as File;
    assert.equal(file.type, "image/jpeg");
    assert.ok(file.size > 0);
    const attached = await sharp(
      Buffer.from(await file.arrayBuffer()),
    ).metadata();
    assert.equal(attached.width, 320);
    assert.match(String(form.get("prompt")), /stone patio by the back door/);
    assert.match(String(form.get("prompt")), /original house/);
    assert.equal(form.get("n"), "1");
    return Response.json({ data: [{ b64_json: edited.toString("base64") }] });
  };
  const result = await createDesign(input, false, {
    apiKey: "test-only",
    fetcher,
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, "ai");
  assert.equal(result.originalImage, input.originalImage);
  assert.match(result.generatedImage, /^data:image\/jpeg;base64,/);
  const output = await sharp(
    Buffer.from(result.generatedImage.split(",")[1], "base64"),
  ).metadata();
  assert.equal(output.width, 320);
  assert.equal(output.height, 200);
});
for (const status of [401, 403, 429, 500])
  test(`provider ${status} returns an error, never a demo fallback`, async () => {
    const fetcher: typeof fetch = async () =>
      new Response("private upstream diagnostic", { status });
    await assert.rejects(
      createDesign(input, false, { apiKey: "test-only", fetcher }),
      (e) =>
        e instanceof DesignError && !e.message.includes("private upstream"),
    );
  });
test("malformed upstream image is rejected", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({ data: [{ b64_json: "not-an-image" }] });
  await assert.rejects(
    createDesign(input, false, { apiKey: "test-only", fetcher }),
    DesignError,
  );
});
test("invalid source is rejected before making a paid request", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => {
    called = true;
    return Response.json({});
  };
  await assert.rejects(
    createDesign(
      { ...input, originalImage: "data:image/jpeg;base64,AAAA" },
      false,
      { apiKey: "test-only", fetcher },
    ),
    DesignError,
  );
  assert.equal(called, false);
});
test("sample planning remains explicitly demo-only", async () => {
  const project = await planProject(input, true);
  assert.equal(project.visualizationMode, "demo");
  assert.equal(project.demo, true);
});
