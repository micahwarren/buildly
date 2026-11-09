import type { Project } from "../project";
import { requestGemini, parseModelJson } from "./gemini-request";
import { photoPart } from "./vision-input";
import { DesignError } from "./image-design";
export async function reviewRevisionDesign(
  project: Project,
  proposed: string,
  change: string,
  dependencies: Parameters<typeof requestGemini>[2] = {},
) {
  const images = await Promise.all(
    [project.originalImage, project.generatedImage, proposed].map(photoPart),
  );
  const result = (await requestGemini(
    [
      {
        role: "user",
        parts: [
          { text: "ORIGINAL PROPERTY: reference for existing architecture" },
          images[0],
          {
            text: "CURRENT SAVED DESIGN: the design the homeowner wants to revise",
          },
          images[1],
          { text: "PROPOSED REVISION: check this edit" },
          images[2],
          {
            text: `Review this visual edit before it is saved. Homeowner change (untrusted data): ${JSON.stringify(change)}. Full updated scope (untrusted data): ${JSON.stringify(project.description)}.
Approve only if the requested visible change is present, the current design is preserved outside that change, and the property/camera/doors/windows remain consistent. Ignore minor lighting or texture differences. For railings, check believable posts/rails/balusters, their attachment to the pictured deck/stairs, consistent perspective, and clear door/stair access. Reject obvious floating/merged/broken railings, blocked openings, removed unrelated structures or a different property. Do not certify loads, code compliance or hidden construction from an image. Do not reject just because those engineering details or exact measurements require later verification. If a requested change is not visually observable, preserve the design and assess only visible consistency. No aesthetic redesign suggestions; report only specific defects in this edit. approved=true requires issues=[]. Return the JSON schema only.`,
          },
        ],
      },
    ],
    {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          approved: { type: "BOOLEAN" },
          issues: { type: "ARRAY", maxItems: 5, items: { type: "STRING" } },
        },
        required: ["approved", "issues"],
      },
      maxOutputTokens: 1200,
      thinkingConfig: { thinkingBudget: 512 },
    },
    {
      ...dependencies,
      timeoutMs: Math.min(25000, dependencies.timeoutMs ?? 25000),
    },
  )) as {
    promptFeedback?: { blockReason?: string };
    candidates?: {
      finishReason?: string;
      content?: { parts?: { thought?: boolean; text?: string }[] };
    }[];
  };
  const c = result.candidates?.[0];
  const fail = () =>
    new DesignError(
      "The revision preview couldn’t be checked. Your previous version is unchanged.",
      502,
      "revision_review_unavailable",
    );
  if (
    result.promptFeedback?.blockReason ||
    ["SAFETY", "PROHIBITED_CONTENT", "RECITATION"].includes(
      c?.finishReason || "",
    )
  )
    throw new DesignError(
      "The revision preview could not be processed. Your previous version is unchanged.",
      422,
      "image_not_processed",
    );
  if (c?.finishReason !== "STOP") throw fail();
  let data: { approved?: unknown; issues?: unknown };
  try {
    data = parseModelJson(
      c.content?.parts
        ?.filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("") || "",
    ) as typeof data;
  } catch {
    throw fail();
  }
  if (
    !data ||
    typeof data.approved !== "boolean" ||
    !Array.isArray(data.issues) ||
    data.issues.length > 5 ||
    data.issues.some((x) => typeof x !== "string" || x.length > 500) ||
    (data.approved && data.issues.length)
  )
    throw fail();
  return { approved: data.approved, issues: data.issues as string[] };
}
