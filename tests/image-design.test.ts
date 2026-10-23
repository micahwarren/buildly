import { imageProviderConfig } from "../lib/image-provider";
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
    createDesign(input, false, { provider: "openai", apiKey: "" }),
    (e) => e instanceof DesignError && e.status === 503,
  );
});
test("explicit demo mode returns an identified illustration", async () => {
  const result = await createDesign(input, true, {
    provider: "openai",
    apiKey: "",
  });
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
    provider: "openai",
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
      createDesign(input, false, {
        provider: "openai",
        apiKey: "test-only",
        fetcher,
      }),
      (e) =>
        e instanceof DesignError && !e.message.includes("private upstream"),
    );
  });
test("malformed upstream image is rejected", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({ data: [{ b64_json: "not-an-image" }] });
  await assert.rejects(
    createDesign(input, false, {
      provider: "openai",
      apiKey: "test-only",
      fetcher,
    }),
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
      { provider: "openai", apiKey: "test-only", fetcher },
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

test("Gemini sends the actual yard image and returns a normalized edited image", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(
      url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
    );
    assert.equal(options?.method, "POST");
    const headers = options?.headers as Record<string, string>;
    assert.equal(headers["x-goog-api-key"], "test-only");
    assert.equal(headers.Authorization, undefined);
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.generationConfig.responseModalities, [
      "TEXT",
      "IMAGE",
    ]);
    assert.equal(body.generationConfig.imageConfig.imageSize, "1K");
    assert.equal(body.generationConfig.imageConfig.aspectRatio, "3:2");
    const parts = body.contents[0].parts;
    assert.equal(parts[0].inlineData.mimeType, "image/jpeg");
    assert.equal(
      (await sharp(Buffer.from(parts[0].inlineData.data, "base64")).metadata())
        .width,
      320,
    );
    assert.match(parts[1].text, /stone patio by the back door/);
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              { text: "Here is the design" },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: edited.toString("base64"),
                },
              },
            ],
          },
        },
      ],
    });
  };
  const result = await createDesign(input, false, {
    provider: "gemini",
    apiKey: "test-only",
    fetcher,
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, "ai");
  assert.equal(result.originalImage, input.originalImage);
  const metadata = await sharp(
    Buffer.from(result.generatedImage.split(",")[1], "base64"),
  ).metadata();
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 200);
});
for (const status of [400, 401, 403, 404, 429, 500])
  test(`Gemini ${status} fails without falling back to another provider or samples`, async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (url) => {
      calls++;
      assert.match(String(url), /generativelanguage.googleapis.com/);
      return new Response("private diagnostic", { status });
    };
    await assert.rejects(
      createDesign(input, false, {
        provider: "gemini",
        apiKey: "test-only",
        fetcher,
      }),
      (e) =>
        e instanceof DesignError && !e.message.includes("private diagnostic"),
    );
    assert.equal(calls, 1);
  });
test("Gemini text-only response cannot be presented as an image", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      candidates: [
        { content: { parts: [{ text: "I cannot edit that image" }] } },
      ],
    });
  await assert.rejects(
    createDesign(input, false, {
      provider: "gemini",
      apiKey: "test-only",
      fetcher,
    }),
    DesignError,
  );
});
test("Gemini safety-blocked image does not fall back to artwork", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({ promptFeedback: { blockReason: "SAFETY" } });
  await assert.rejects(
    createDesign(input, false, {
      provider: "gemini",
      apiKey: "test-only",
      fetcher,
    }),
    (e) => e instanceof DesignError && e.status === 422,
  );
});

test("provider selection defaults to Gemini and never reuses the other provider key", () => {
  const defaults = imageProviderConfig({ OPENAI_API_KEY: "unused-test-value" });
  assert.equal(defaults.provider, "gemini");
  assert.equal(defaults.apiKey, undefined);
  const gemini = imageProviderConfig({
    GEMINI_API_KEY: "google-test-value",
    OPENAI_API_KEY: "unused-test-value",
  });
  assert.equal(gemini.apiKey, "google-test-value");
  assert.equal(gemini.model, "gemini-3.1-flash-image");
  const openai = imageProviderConfig({
    IMAGE_PROVIDER: "openai",
    OPENAI_API_KEY: "openai-test-value",
    GEMINI_API_KEY: "unused-test-value",
  });
  assert.equal(openai.provider, "openai");
  assert.equal(openai.apiKey, "openai-test-value");
  assert.equal(
    imageProviderConfig({ IMAGE_PROVIDER: "invalid" }).provider,
    null,
  );
});
