import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// One-time release operation only. Normal builds never upload review assets.
if (process.env.SITEAI_IAP_REVIEW_UPLOAD !== "1")
  throw Error("Explicit private IAP screenshot upload opt-in required");
const assets = JSON.parse(process.env.SITEAI_IAP_REVIEW_UPLOAD_OPERATIONS || "null");
const products = new Set(["6830388229", "6830416398", "6830416324"]);
if (!Array.isArray(assets) || assets.length !== products.size)
  throw Error("Exactly the three existing token products are required");
const bytes = await readFile("public/appstore/review/project-tokens.png");
const checksum = createHash("md5").update(bytes).digest("hex");
const seen = new Set();
for (const asset of assets) {
  if (!products.has(asset.product) || seen.has(asset.product))
    throw Error("Unexpected or duplicate token product");
  seen.add(asset.product);
  if (
    asset.fileName !== "site-ai-token-review-v44.png" ||
    asset.fileSize !== bytes.length ||
    asset.checksum !== checksum ||
    !Array.isArray(asset.operations) ||
    asset.operations.length === 0
  )
    throw Error("Review screenshot differs from the Apple reservation");
  let total = 0;
  for (const op of asset.operations) {
    const url = new URL(op.url);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)(apple\.com|icloud\.com)$/.test(url.hostname) ||
      op.method !== "PUT" ||
      !Number.isSafeInteger(op.offset) ||
      !Number.isSafeInteger(op.length) ||
      op.offset !== total ||
      op.length <= 0 ||
      op.offset + op.length > bytes.length
    )
      throw Error("Expected a complete upload to Apple's reserved destination");
    const response = await fetch(url, {
      method: "PUT",
      headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
      body: bytes.subarray(op.offset, op.offset + op.length),
      signal: AbortSignal.timeout(90000),
      redirect: "error",
    });
    if (!response.ok)
      throw Error(`Apple private IAP screenshot upload failed: HTTP ${response.status}`);
    total += op.length;
  }
  if (total !== bytes.length) throw Error("Incomplete private review screenshot");
  console.log("Apple IAP review bytes uploaded:", asset.product, bytes.length);
}
console.log("All three private IAP review byte uploads completed; Apple commit and processing remain to be verified.");
