import fs from "node:fs";
const testPayments = process.env.TESTFLIGHT_PAYMENTS !== "false";
const required = ["BUILDLY_APP_URL", "APPLE_TEAM_ID"];
if (testPayments)
  required.push(
    "NEXT_PUBLIC_REVENUECAT_IOS_KEY",
    "NEXT_PUBLIC_PROJECT_PRODUCT_ID",
  );
if (process.env.GITHUB_ACTIONS === "true")
  required.push("APPLE_KEY_ID", "APPLE_ISSUER_ID", "APPLE_PRIVATE_KEY");
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
if (!config.imageGenerationAvailable)
  throw new Error("Deploy AI configuration before building a release.");
if (testPayments && !config.billingEnabled)
  throw new Error("Enable billing on the hosted app before testing purchases.");
if (!testPayments && config.billingEnabled)
  throw new Error(
    "This build is for testing without purchases. Use a deployment with billing disabled, or enable the Test App Store purchases workflow option.",
  );
for (const file of [
  "ios/App/App/Info.plist",
  "ios/App/App/PrivacyInfo.xcprivacy",
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
])
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
console.log(
  testPayments
    ? "Release configuration checks passed. StoreKit purchases and device behavior still need sandbox testing."
    : "Configuration checks passed for testing with payments disabled. The hosted app controls billing; keep it disabled throughout this test.",
);
