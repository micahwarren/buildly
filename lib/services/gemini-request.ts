import { recordUsage } from "../production/telemetry";
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
type ListedModel = { name: string; outputTokenLimit?: number };
/** Only numbered, stable general-purpose Flash releases are auto-selected.
 * Lexicographic sorting of arbitrary model names selected omni preview before 3.x.
 */
export function compatiblePlanningModels(value: unknown): ListedModel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (model): model is ListedModel =>
        model &&
        typeof model.name === "string" &&
        /^models\/gemini-\d+(?:\.\d+)?-flash(?:-\d+)?$/.test(model.name) &&
        Array.isArray(model.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes("generateContent"),
    )
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
}
export function rejectionReason(message: string) {
  if (/response.?mime|mime.?type|json mode/i.test(message))
    return "response-format";
  if (/schema|structured output/i.test(message)) return "response-schema";
  if (/max.?output.?tokens|output.?token.?limit|maximum.*tokens/i.test(message))
    return "output-token-limit";
  if (
    /image.*(?:not supported|unsupported)|(?:not supported|unsupported).*image/i.test(
      message,
    )
  )
    return "image-input";
  if (
    /(?:model|generateContent).*(?:not supported|unsupported|not available)/i.test(
      message,
    )
  )
    return "model-capability";
  return "request-argument";
}
/** Accept an optional complete JSON code fence; do not extract JSON from arbitrary prose. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}
/** One deadline bounds discovery and compatibility retries; never retry auth/quota errors. */
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
  let discovered = false;
  const alternatives: ListedModel[] = [];
  const tried = new Set([model]);
  let lastError: DesignError | undefined;
  const attachSpecification = () => {
    if (!config.responseSchema) return contents;
    const instruction = {
      text: `Return only a JSON object conforming exactly to this schema, including all required fields. Do not add markdown or prose: ${JSON.stringify(config.responseSchema)}`,
    };
    // Attach to the existing user message; preserve both image parts and roles.
    return contents
      .map((content, index) => {
        if (
          index !== contents.length - 1 ||
          !content ||
          typeof content !== "object"
        )
          return content;
        const value = content as { parts?: unknown[] };
        return { ...content, parts: [...(value.parts || []), instruction] };
      })
      .concat(contents.length ? [] : [{ role: "user", parts: [instruction] }]);
  };
  async function nextModel() {
    if (pinned) return false;
    if (!discovered) {
      discovered = true;
      // A bounded paginated lookup avoids missing a stable model behind previews.
      let pageToken = "";
      for (let page = 0; page < 3; page++) {
        const url =
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100" +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
        const response = await fetcher(url, { headers, signal });
        if (!response.ok) break;
        const data = await response.json();
        alternatives.push(...compatiblePlanningModels(data.models));
        if (typeof data.nextPageToken !== "string" || !data.nextPageToken)
          break;
        pageToken = data.nextPageToken;
      }
      alternatives.sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true }),
      );
    }
    const next = alternatives.find(
      (candidate) => !tried.has(candidate.name.replace("models/", "")),
    );
    if (!next) return false;
    model = next.name.replace("models/", "");
    tried.add(model);
    generationConfig = { ...config };
    if (
      typeof next.outputTokenLimit === "number" &&
      next.outputTokenLimit > 0 &&
      typeof generationConfig.maxOutputTokens === "number"
    )
      generationConfig.maxOutputTokens = Math.min(
        generationConfig.maxOutputTokens,
        next.outputTokenLimit,
      );
    requestContents = contents;
    return true;
  }
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      // Numeric thinking budgets are supported by 2.5 Flash. Do not impose
      // those settings on a user-pinned or discovered model from another family.
      const compatibleConfig = { ...generationConfig };
      if (!/^gemini-2\.5-flash(?:-\d+)?$/.test(model))
        delete compatibleConfig.thinkingConfig;
      const response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({
            contents: requestContents,
            generationConfig: compatibleConfig,
          }),
        },
      );
      if (response.ok) {
        try {
          const result = await response.json();
          recordUsage("google", model, result.usageMetadata);
          return result;
        } catch {
          throw new DesignError(
            "Google returned an unreadable planning response. Your saved image can be reused.",
          );
        }
      }
      let provider: { error?: { message?: string; status?: string } } = {};
      try {
        provider = await response.json();
      } catch {
        /* Upstream may return a non-JSON error. */
      }
      const code =
        typeof provider.error?.status === "string" &&
        /^[A-Z_]{1,60}$/.test(provider.error.status)
          ? provider.error.status
          : "";
      const reason = rejectionReason(
        typeof provider.error?.message === "string"
          ? provider.error.message
          : "",
      );
      // Only controlled diagnostic labels: never raw upstream text, keys or photo data.
      console.warn("buildly_gemini_failure", {
        status: response.status,
        code,
        model,
        reason,
      });
      lastError = planningError(response.status, model, code);
      if (response.status === 400)
        lastError.message += ` Diagnostic: ${reason}.`;
      if (response.status === 404 && (await nextModel())) continue;
      if (
        response.status === 400 &&
        ["response-schema", "response-format"].includes(reason)
      ) {
        if (generationConfig.responseSchema) {
          delete generationConfig.responseSchema;
          if (reason === "response-format")
            delete generationConfig.responseMimeType;
          requestContents = attachSpecification();
          continue;
        }
        if (generationConfig.responseMimeType) {
          delete generationConfig.responseMimeType;
          requestContents = attachSpecification();
          continue;
        }
      }
      if (
        response.status === 400 &&
        reason !== "request-argument" &&
        (await nextModel())
      )
        continue;
      throw lastError;
    }
    throw (
      lastError ||
      new DesignError(
        "The planning request could not be accepted. Your saved image can be reused.",
      )
    );
  } catch (error) {
    if (error instanceof DesignError) throw error;
    const timedOut =
      signal.aborted ||
      (error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name));
    console.warn("buildly_planning_transport", {
      model,
      reason: timedOut ? "timeout" : "connection",
      timeoutMs: dependencies.timeoutMs ?? 45000,
    });
    throw new DesignError(
      timedOut
        ? "Planning reached its time limit before Google finished. Your image is saved; retry the plan from this design."
        : "The planning server could not connect to Google. Your image is saved; retry the plan shortly.",
      timedOut ? 504 : 502,
    );
  }
}
