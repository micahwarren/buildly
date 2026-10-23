import { DesignError } from "./image-design";
type Dependencies = {
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};
export function planningError(
  status: number,
  model: string,
  providerStatus = "",
) {
  const prefix = `Planning service (${status}${providerStatus ? ` ${providerStatus}` : ""}; model ${model}): `;
  if (status === 404)
    return new DesignError(
      prefix +
        "this model is unavailable. Set GEMINI_PLANNING_MODEL to a text-and-vision model available in your Google AI Studio account, then redeploy. Your saved image can be reused.",
      503,
    );
  if (status === 400)
    return new DesignError(
      prefix +
        "Google rejected the request format or model settings. Your image is saved; this needs an application configuration fix, not another image purchase.",
      502,
    );
  if (status === 401 || status === 403)
    return new DesignError(
      prefix +
        "Google denied access. Check the Gemini API key's restrictions and this model's access in Google AI Studio.",
      503,
    );
  if (status === 429)
    return new DesignError(
      prefix +
        "Google's quota or rate limit was reached. Check Gemini usage and billing, then retry the saved design.",
      429,
    );
  return new DesignError(
    prefix +
      "Google is temporarily unable to complete the request. Retry the saved design later.",
    502,
  );
}
/** One deadline across retries; model discovery only follows an unavailable default model. */
export async function requestGemini(
  contents: unknown[],
  config: Record<string, unknown>,
  dependencies: Dependencies = {},
): Promise<unknown> {
  const key = dependencies.apiKey ?? process.env.GEMINI_API_KEY;
  let model =
    dependencies.model ??
    process.env.GEMINI_PLANNING_MODEL ??
    "gemini-2.5-flash";
  const pinned = !!(dependencies.model || process.env.GEMINI_PLANNING_MODEL);
  if (!key || !/^[a-zA-Z0-9._-]+$/.test(model))
    throw new DesignError(
      "AI planning needs a valid Gemini API key and text/vision model configuration.",
      503,
    );
  const fetcher = dependencies.fetcher ?? fetch;
  const signal = AbortSignal.timeout(dependencies.timeoutMs ?? 45000);
  const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
  let generationConfig = { ...config };
  let requestContents = contents;
  let retriedModel = false,
    retriedSchema = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({ contents: requestContents, generationConfig }),
        },
      );
      if (response.ok) return await response.json();
      let provider: { error?: { message?: string; status?: string } } = {};
      try {
        provider = await response.json();
      } catch {
        /* Non-JSON upstream failure. */
      }
      // Never log or expose raw upstream text, request bodies, headers or keys.
      const code =
        typeof provider.error?.status === "string" &&
        /^[A-Z_]{1,60}$/.test(provider.error.status)
          ? provider.error.status
          : "";
      console.warn("buildly_gemini_failure", {
        status: response.status,
        code,
        model,
      });
      if (response.status === 404 && !pinned && !retriedModel) {
        retriedModel = true;
        const available = await fetcher(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
          { headers, signal },
        );
        if (available.ok) {
          const list = await available.json();
          const models = (Array.isArray(list.models) ? list.models : []).filter(
            (m: { name?: unknown; supportedGenerationMethods?: string[] }) =>
              typeof m.name === "string" &&
              /^models\/gemini-[a-zA-Z0-9._-]*flash[a-zA-Z0-9._-]*$/.test(
                m.name,
              ) &&
              !/image|audio|tts|live|lite/i.test(m.name) &&
              m.name !== `models/${model}` &&
              m.supportedGenerationMethods?.includes("generateContent"),
          );
          models.sort((a: { name: string }, b: { name: string }) =>
            b.name.localeCompare(a.name, undefined, { numeric: true }),
          );
          if (models[0]) {
            model = models[0].name.replace("models/", "");
            continue;
          }
        }
      }
      // Some supported models reject complex response schemas. Retry JSON mode once,
      // carry the same schema in the instruction, and keep full runtime validation.
      if (
        response.status === 400 &&
        !retriedSchema &&
        generationConfig.responseSchema &&
        /schema/i.test(provider.error?.message || "")
      ) {
        retriedSchema = true;
        const schema = generationConfig.responseSchema;
        generationConfig = { ...generationConfig };
        delete generationConfig.responseSchema;
        requestContents = [
          ...contents,
          {
            role: "user",
            parts: [
              {
                text: `Return JSON conforming exactly to this schema, including all required fields: ${JSON.stringify(schema)}`,
              },
            ],
          },
        ];
        continue;
      }
      throw planningError(response.status, model, code);
    }
    throw new DesignError(
      "The planning service could not accept the request. Your image is saved; retry later.",
    );
  } catch (error) {
    if (error instanceof DesignError) throw error;
    throw new DesignError(
      "Planning could not connect or timed out. Your image is saved; retry from this design.",
      504,
    );
  }
}
