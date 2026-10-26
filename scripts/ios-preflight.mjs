import fs from "node:fs";
const required = [
  "BUILDLY_APP_URL",
  "APPLE_TEAM_ID",
  "NEXT_PUBLIC_REVENUECAT_IOS_KEY",
  "NEXT_PUBLIC_PROJECT_PRODUCT_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing release configuration: " + missing.join(", "));
  process.exit(1);
}
const url = new URL(process.env.BUILDLY_APP_URL);
if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash)
  throw new Error("BUILDLY_APP_URL must be an HTTPS origin.");
const response = await fetch(new URL("/api/config", url));
if (!response.ok) throw new Error("Could not reach deployed Buildly.");
const config = await response.json();
if (!config.billingEnabled || !config.imageGenerationAvailable)
  throw new Error(
    "Deploy billing and AI configuration before building a release.",
  );
for (const file of [
  "ios/App/App/Info.plist",
  "ios/App/App/PrivacyInfo.xcprivacy",
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
])
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
console.log(
  "Release configuration checks passed. StoreKit purchases and device behavior still need sandbox testing.",
);
