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
  execFileSync(process.execPath, [fileURLToPath(new URL("./bootstrap-review.mjs", import.meta.url))], { stdio: "inherit", timeout: 90000 });
}

if (process.env.SITEAI_DELETION_QA === "1") {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),fileURLToPath(new URL("./deletion-release-check.ts", import.meta.url))], {stdio:"inherit", timeout:150000});
}

if (process.env.SITEAI_MARKETING_SAMPLES === "1") {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),fileURLToPath(new URL("./marketing-samples.ts", import.meta.url))], {stdio:"inherit", timeout:12*60000});
}

