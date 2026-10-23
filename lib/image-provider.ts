export type ImageProvider = "gemini" | "openai";
/** Only the explicitly selected provider's credentials are used. No cross-provider fallback. */
export function imageProviderConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const provider = env.IMAGE_PROVIDER || "gemini";
  if (provider === "gemini")
    return {
      provider: provider as ImageProvider,
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
    };
  if (provider === "openai")
    return {
      provider: provider as ImageProvider,
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    };
  return { provider: null, apiKey: undefined, model: "" };
}
