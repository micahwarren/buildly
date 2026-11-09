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
  assert.match(legal.refunds[0].text, /^Last updated November 7, 2026\./);
  for (const document of [legal.privacy, legal.terms])
    assert.match(document[0].text, /^Last updated November 9, 2026\./);
  const terms = legal.terms.map((p) => p.text).join(" ");
  for (const phrase of [
    "personal injury",
    "property damage",
    "budget overruns",
    "gross negligence",
    "mandatory consumer guarantees",
    "non-waivable protections",
    "after you accept them",
  ])
    assert.ok(terms.includes(phrase));
  assert.match(
    terms,
    /only to the extent such liability may lawfully be excluded or limited/,
  );
  assert.match(
    legal.privacy.map((p) => p.text).join(" "),
    /do not remove your privacy rights or our duties/,
  );
});
