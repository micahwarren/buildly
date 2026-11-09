import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// Explicit operator opt-in only: normal builds never run billable AI requests.
if (process.env.SIGHTSAW_LIVE_RELEASE_CHECK === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./live-generation-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 12 * 60_000 },
  );
}

if (process.env.SITEAI_REVIEW_BOOTSTRAP === "1") {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./bootstrap-review.mjs", import.meta.url))],
    { stdio: "inherit", timeout: 90000 },
  );
}

if (process.env.SITEAI_DELETION_QA === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./deletion-release-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 150000 },
  );
}

if (process.env.SITEAI_MARKETING_SAMPLES === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./marketing-samples.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 12 * 60000 },
  );
}

if (process.env.SITEAI_MARKETING_ARTIFACT_IMPORT === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("./export-marketing-artifacts.mjs", import.meta.url),
      ),
    ],
    { stdio: "inherit", timeout: 90000 },
  );
}

if (process.env.SITEAI_APPSTORE_ASSET_UPLOAD === "1") {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./upload-appstore-assets.mjs", import.meta.url))],
    { stdio: "inherit", timeout: 8 * 60000 },
  );
}

if (process.env.SITEAI_MAIL_DELIVERY_CHECK === "1") {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./mail-delivery-check.mjs", import.meta.url))],
    { stdio: "inherit", timeout: 210000 },
  );
}

if (process.env.SITEAI_BILLING_SYNC_CHECK === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./billing-sync-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 90000 },
  );
}

if (process.env.SITEAI_IAP_REVIEW_UPLOAD === "1") {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./upload-iap-review.mjs", import.meta.url))],
    { stdio: "inherit", timeout: 6 * 60000 },
  );
}

if (process.env.SITEAI_SECURITY_QA === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./security-release-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 180000 },
  );
}

if (process.env.SITEAI_APPLE_CONFIG_QA === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./apple-config-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 45000 },
  );
}

if (process.env.SITEAI_PUBLIC_HOST_QA === "1") {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./public-host-check.mjs", import.meta.url))],
    { stdio: "inherit", timeout: 90000 },
  );
}

if (process.env.SITEAI_SEED_STARTERS === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./seed-starter-tokens.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 180000 },
  );
}

if (process.env.SITEAI_DEVICECHECK_QA === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./devicecheck-config-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 45000 },
  );
}

if (process.env.SITEAI_MATERIAL_AUDIT_QA === "1") {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
      ),
      fileURLToPath(new URL("./material-audit-check.ts", import.meta.url)),
    ],
    { stdio: "inherit", timeout: 210000 },
  );
}
