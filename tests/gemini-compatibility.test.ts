import test from "node:test";
import assert from "node:assert/strict";
import {
  compatiblePlanningModels,
  parseModelJson,
  requestGemini,
} from "../lib/services/gemini-request";
const listed = (name: string, outputTokenLimit = 8192) => ({
  name: `models/${name}`,
  supportedGenerationMethods: ["generateContent"],
  outputTokenLimit,
});
test("reported omni preview can never outrank a stable numbered planning model", () => {
  const models = compatiblePlanningModels([
    listed("gemini-omni-flash-preview"),
    listed("gemini-3.8-flash"),
    listed("gemini-2.5-flash"),
    listed("gemini-4-flash-preview"),
    listed("gemini-3.8-flash-image"),
    listed("gemini-3.8-flash-lite"),
    listed("gemini-3.8-flash-tts"),
    listed("gemini-flash-latest"),
    {
      ...listed("gemini-9-flash"),
      supportedGenerationMethods: ["embedContent"],
    },
  ]);
  assert.deepEqual(
    models.map((m) => m.name),
    ["models/gemini-3.8-flash", "models/gemini-2.5-flash"],
  );
});
test("unavailable default discovers stable model after previews and caps its output tokens", async () => {
  const calls: string[] = [];
  const result = await requestGemini(
    [{ role: "user", parts: [{ text: "My project" }] }],
    { maxOutputTokens: 16000, responseMimeType: "application/json" },
    {
      apiKey: "test",
      fetcher: async (url, init) => {
        calls.push(String(url));
        if (String(url).includes("gemini-2.5-flash:generateContent"))
          return Response.json(
            { error: { status: "NOT_FOUND" } },
            { status: 404 },
          );
        if (String(url).includes("pageToken="))
          return Response.json({ models: [listed("gemini-3.8-flash")] });
        if (String(url).includes("/models?"))
          return Response.json({
            models: [listed("gemini-omni-flash-preview")],
            nextPageToken: "next-page",
          });
        assert.match(String(url), /gemini-3.8-flash:generateContent/);
        assert.equal(
          JSON.parse(init!.body as string).generationConfig.maxOutputTokens,
          8192,
        );
        return Response.json({ ok: true });
      },
    },
  );
  assert.deepEqual(result, { ok: true });
  assert.ok(!calls.some((url) => url.includes("omni")));
});
test("schema and JSON-format incompatibilities retry while preserving the photos and validation specification", async () => {
  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: "original" } },
        { inlineData: { mimeType: "image/jpeg", data: "design" } },
        { text: "Create a plan" },
      ],
    },
  ];
  const bodies: {
    contents: typeof contents;
    generationConfig: Record<string, unknown>;
  }[] = [];
  await requestGemini(
    contents,
    {
      responseSchema: { type: "OBJECT" },
      responseMimeType: "application/json",
      maxOutputTokens: 16000,
    },
    {
      apiKey: "test",
      fetcher: async (_url, init) => {
        bodies.push(JSON.parse(init!.body as string));
        if (bodies.length === 1)
          return Response.json(
            {
              error: {
                status: "INVALID_ARGUMENT",
                message: "response_schema is unsupported",
              },
            },
            { status: 400 },
          );
        if (bodies.length === 2)
          return Response.json(
            {
              error: {
                status: "INVALID_ARGUMENT",
                message: "response_mime_type is not supported",
              },
            },
            { status: 400 },
          );
        return Response.json({ ok: true });
      },
    },
  );
  assert.equal(bodies.length, 3);
  assert.equal(bodies[2].generationConfig.responseSchema, undefined);
  assert.equal(bodies[2].generationConfig.responseMimeType, undefined);
  assert.equal(bodies[2].contents.length, 1);
  assert.deepEqual(
    bodies[2].contents[0].parts.slice(0, 2),
    contents[0].parts.slice(0, 2),
  );
  assert.match(
    JSON.stringify(bodies[2].contents),
    /conforming exactly to this schema/,
  );
});
test("permission and quota failures never trigger another model or format retry", async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    await assert.rejects(
      requestGemini(
        [],
        { responseSchema: {} },
        {
          apiKey: "test",
          fetcher: async () => {
            calls++;
            return Response.json(
              { error: { message: "secret request data" } },
              { status },
            );
          },
        },
      ),
      (error) =>
        error instanceof Error &&
        error.message.includes(String(status)) &&
        !error.message.includes("secret request data"),
    );
    assert.equal(calls, 1);
  }
});
test("JSON compatibility parser accepts a complete fence, not arbitrary surrounding prose", () => {
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseModelJson('{"ok":true}'), { ok: true });
  assert.throws(() => parseModelJson('Here is the answer: {"ok":true}'));
});
