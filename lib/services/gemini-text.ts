import { requestGemini, parseModelJson } from "./gemini-request";
import { DesignError } from "./image-design";
/** Server-only JSON text adapter; never substitutes a sample response. */
export async function geminiJson(
  prompt: string,
  schema: Record<string, unknown>,
  dependencies: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<unknown> {
  const data = (await requestGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 6000,
    },
    { ...dependencies, timeoutMs: 40000 },
  )) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { thought?: boolean; text?: string }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };
  try {
    const candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || candidate?.finishReason !== "STOP")
      throw Error("Incomplete");
    const text = candidate?.content?.parts
      ?.filter(
        (p: { thought?: boolean; text?: unknown }) =>
          !p.thought && typeof p.text === "string",
      )
      .map((p) => p.text || "")
      .join("");
    return parseModelJson(text || "");
  } catch {
    throw new DesignError(
      "The AI assistant returned an incomplete response. Your project is unchanged; please try again.",
    );
  }
}
