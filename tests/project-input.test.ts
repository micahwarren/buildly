import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readProjectRequest } from "../lib/project-request";
import { makeDemo } from "../lib/project";
import { createDesign, designPrompt } from "../lib/services/image-design";
import { interpretRefinement } from "../lib/services/refine-project";
const photo = "data:image/jpeg;base64,AAAA";
const request = (body: object) =>
  new Request("https://example.com/api/projects", {
    method: "POST",
    body: JSON.stringify({
      originalImage: photo,
      description: "Replace a door with a white paneled door",
      ...body,
    }),
  });
test("description-only projects keep absent and partially supplied dimensions unknown", async () => {
  const { input } = await readProjectRequest(request({}));
  assert.equal(input.projectType, "Something else");
  const project = makeDemo(input);
  assert.equal(project.width, 0);
  assert.equal(project.length, 0);
  assert.doesNotMatch(designPrompt(project), /12 feet|16 feet/);
  assert.match(designPrompt(project), /not provided/);
  assert.equal(
    (await readProjectRequest(request({ width: 2.5 }))).input.width,
    2.5,
  );
  assert.equal(
    (await readProjectRequest(request({ width: 2.5 }))).input.length,
    0,
  );
  await assert.rejects(readProjectRequest(request({ width: -2 })), /positive/);
  await assert.rejects(
    readProjectRequest(request({ width: "12" })),
    /positive/,
  );
});
test("optional reference types are bounded and cannot contain remote or executable images", async () => {
  const { input } = await readProjectRequest(
    request({ referenceImages: [photo], materialImages: [photo] }),
  );
  assert.deepEqual(input.referenceImages, [photo]);
  assert.deepEqual(input.materialImages, [photo]);
  await assert.rejects(
    readProjectRequest(request({ referenceImages: [photo, photo, photo] })),
    /two/,
  );
  await assert.rejects(
    readProjectRequest(
      request({ materialImages: ["https://example.com/photo.jpg"] }),
    ),
    /two/,
  );
  await assert.rejects(
    readProjectRequest(request({ referenceImages: [null] })),
    /two/,
  );
});
test("both image providers receive labeled inspiration and materials, with the site first", async () => {
  const jpeg = await sharp({
    create: { width: 20, height: 30, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  const image = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const input = makeDemo({
    originalImage: image,
    referenceImages: [image],
    materialImages: [image],
    width: 0,
    length: 0,
  });
  for (const provider of ["gemini", "openai"] as const) {
    await createDesign(input, false, {
      provider,
      apiKey: "fixture",
      fetcher: async (_url, init) => {
        if (provider === "gemini") {
          const body = JSON.parse(init!.body as string);
          const parts = body.contents[0].parts;
          assert.ok(parts[0].inlineData);
          assert.equal(
            parts.filter((p: { inlineData?: unknown }) => p.inlineData).length,
            3,
          );
          assert.match(parts[1].text, /INSPIRATION/);
          assert.match(parts[3].text, /MATERIAL/);
          return Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/jpeg",
                        data: jpeg.toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          });
        }
        const body = init!.body as FormData;
        assert.equal(body.getAll("image[]").length, 3);
        assert.match(String(body.get("prompt")), /INSPIRATION, MATERIAL/);
        return Response.json({ data: [{ b64_json: jpeg.toString("base64") }] });
      },
    });
  }
});
test("revisions preserve unknown dimensions rather than requiring invented defaults", async () => {
  const result = await interpretRefinement(
    makeDemo({ width: 0, length: 0 }),
    "Use a white finish",
    {
      apiKey: "fixture",
      fetcher: async () =>
        Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      description: "Use a white finish",
                      width: 0,
                      length: 0,
                      clarification: "",
                    }),
                  },
                ],
              },
            },
          ],
        }),
    },
  );
  assert.equal(result.width, 0);
  assert.equal(result.length, 0);
});
