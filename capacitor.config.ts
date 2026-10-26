import type { CapacitorConfig } from "@capacitor/cli";
const origin = process.env.BUILDLY_APP_URL || "https://buildly-ecru.vercel.app";
if (new URL(origin).protocol !== "https:")
  throw new Error("The iOS app requires an HTTPS deployment.");
const config: CapacitorConfig = {
  appId: "com.nomapps.buildly",
  appName: "Buildly",
  webDir: "mobile",
  server: { url: origin, cleartext: false, errorPath: "index.html" },
  ios: { contentInset: "automatic", preferredContentMode: "mobile" },
};
export default config;
