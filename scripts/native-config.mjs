import fs from "node:fs";
const origin = new URL(
  process.env.BUILDLY_APP_URL || "https://buildly-ecru.vercel.app",
);
if (origin.protocol !== "https:") throw new Error("HTTPS backend required");
const res = await fetch(new URL("/api/config", origin));
if (!res.ok) throw new Error("Cannot reach backend configuration");
const config = await res.json();
if (!config.supabaseUrl || !config.supabasePublishableKey)
  throw new Error(
    "Deploy the updated /api/config endpoint with Supabase configured first.",
  );
if (config.billingEnabled)
  throw new Error(
    "This first native beta requires billing disabled until native purchases are integrated.",
  );
// Public client configuration only. Never embed Gemini or service-role secrets.
const str = (s) => JSON.stringify(s).replaceAll("\\/", "/");
fs.writeFileSync(
  "ios-native/Sources/Configuration.swift",
  `enum Configuration {\n static let backend = ${str(origin.origin)}\n static let supabase = ${str(config.supabaseUrl)}\n static let publicKey = ${str(config.supabasePublishableKey)}\n}\n`,
);
console.log("Native public configuration generated.");
