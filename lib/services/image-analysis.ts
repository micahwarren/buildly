/** Replace with a server-side vision provider. Do not infer verified measurements from photos. */
export async function analyzeImage(originalImage: string) {
  return {
    originalImage,
    mode: "demo" as const,
    observations: [
      "Photo preserved as supplied. No live image analysis performed.",
    ],
  };
}
