import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("confirmation email preserves the real auth URL variable and contains the branded CTA", async () => {
  const html = await readFile(
    new URL("../supabase/templates/confirmation.html", import.meta.url),
    "utf8",
  );
  assert.match(
    html,
    /Welcome to Buildly! Confirm your email to start planning your projects\./,
  );
  assert.match(
    html,
    /href="\{\{ \.ConfirmationURL \}\}"[^>]*>Confirm email<\/a>/,
  );
  assert.equal((html.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, 3);
  assert.doesNotMatch(html, /supabase|<script|<img/i);
  assert.match(html, /#234637/);
  assert.match(html, /#c4512d/);
  assert.match(html, /font-family:/);
});
