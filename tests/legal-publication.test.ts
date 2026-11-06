import test from "node:test";
import assert from "node:assert/strict";
import { legal } from "../lib/legal-content";
test("refund disclosures preserve Apple's process, recovery without repurchase and mandatory remedies", () => {
  const text = legal.refunds.map((p) => p.text).join("\n");
  assert.match(text, /https:\/\/reportaproblem\.apple\.com/);
  assert.match(text, /Do not buy again to recover/);
  assert.match(text, /before its design image is saved releases/);
  assert.match(text, /Recovering that plan does not use another token/);
  assert.match(text, /cannot promise approval or an automatic refund/);
  assert.match(text, /does not limit refund rights, consumer guarantees/);
  assert.match(
    legal.terms.map((p) => p.text).join(" "),
    /Apple’s Standard End User License Agreement/,
  );
  for (const document of Object.values(legal))
    assert.match(document[0].text, /^Last updated November 6, 2026\./);
});
