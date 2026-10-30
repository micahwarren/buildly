import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<{ id: string }>();
export const withOperation = <T>(id: string, work: () => Promise<T>) =>
  context.run({ id }, work);
export function recordUsage(
  provider: "google" | "openai",
  model: string,
  usage: unknown,
) {
  if (!usage || typeof usage !== "object") return;
  const fields = [
    "promptTokenCount",
    "candidatesTokenCount",
    "thoughtsTokenCount",
    "totalTokenCount",
    "input_tokens",
    "output_tokens",
    "total_tokens",
  ];
  const tokens: Record<string, number> = {};
  for (const key of fields) {
    const value = (usage as Record<string, unknown>)[key];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value < 1e9
    )
      tokens[key] = value;
  }
  if (Object.keys(tokens).length)
    console.info("buildly_ai_usage", {
      operation: context.getStore()?.id,
      provider,
      model,
      ...tokens,
    });
}
