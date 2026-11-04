import type { CapacitorConfig } from "@capacitor/cli";
const origin =
  process.env.SIGHTSAW_APP_URL ||
  process.env.BUILDLY_APP_URL ||
  "https://sightsaw-diy.vercel.app";
if (new URL(origin).protocol !== "https:")
  throw new Error("The iOS app requires an HTTPS deployment.");
const config: CapacitorConfig = {
  appId: "com.nomapps.buildly",
  appName: "Site AI",
  webDir: "mobile",
  server: { url: origin, cleartext: false, errorPath: "index.html" },
  ios: { contentInset: "automatic", preferredContentMode: "mobile" },
};
export default config;
