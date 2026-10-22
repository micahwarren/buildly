import { chromium } from "playwright";
import assert from "node:assert/strict";
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "buildly-e2e-"));
console.log("Test artifacts: " + output);
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE_URL);
  await page
    .getByRole("heading", { name: "See it. Plan it. Build it." })
    .waitFor();
  await page.screenshot({
    path: path.join(output, "home-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".hero-visual>img")
    .screenshot({ path: path.join(output, "yard.png") });
  await page.getByRole("button", { name: "Before", exact: true }).click();
  assert.equal(
    await page.locator(".hero-visual>img").getAttribute("src"),
    "/images/before.svg",
  );
  await page
    .getByRole("button", { name: "Start my project", exact: true })
    .first()
    .click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(path.join(output, "yard.png"));
  await page.getByRole("button", { name: "Use this photo" }).click();
  await page.getByRole("button", { name: "Pergola", exact: true }).click();
  await page
    .getByLabel("Tell us what you’re imagining")
    .fill("A cedar pergola for family dinners in our backyard.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Width (feet)").fill("14");
  await page.getByLabel("Length (feet)").fill("18");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "$2,500–$5,000", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Some experience", exact: true })
    .click();
  await page.getByRole("button", { name: "Create my sample project" }).click();
  await page.getByRole("heading", { name: "Here’s your project." }).waitFor();
  assert.match(await page.locator(".result-heading").innerText(), /14 × 18/);
  await page.getByRole("slider").fill("30");
  await page
    .getByRole("button", { name: "Save my project", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page.getByRole("tab", { name: "Materials", exact: true }).click();
  assert.ok((await page.locator("tbody tr").count()) > 0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save shopping list" }).click();
  assert.equal(
    (await download).suggestedFilename(),
    "buildly-shopping-list.txt",
  );
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("tab", { name: "Build steps", exact: true }).click();
  await page.getByRole("button", { name: "Done — next step" }).click();
  assert.match(
    await page.locator(".build-mode").innerText(),
    /1 \/ 7 complete/,
  );
  await page
    .getByRole("tab", { name: "Ask about my project", exact: true })
    .click();
  await page.getByLabel("Your question").fill("Can I use cedar instead?");
  await page.locator("form").getByRole("button").click();
  await page.locator(".message").nth(1).waitFor();
  assert.match(await page.locator(".message").nth(1).innerText(), /Cedar/);
  await page.reload();
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue project" }).click();
  await page.getByRole("tab", { name: "Build steps", exact: true }).click();
  assert.match(
    await page.locator(".build-mode").innerText(),
    /1 \/ 7 complete/,
  );
  await page
    .getByRole("tab", { name: "Ask about my project", exact: true })
    .click();
  assert.equal(await page.locator(".message").count(), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Buildly home" }).click();
  await page.screenshot({
    path: path.join(output, "home-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue project" }).click();
  await page.screenshot({
    path: path.join(output, "result-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const bad = await page.request.post(BASE_URL + "/api/projects", {
    data: { description: "x" },
  });
  assert.equal(bad.status(), 400);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: upload, wizard, dimensions, demo generation, comparison, materials download, tools, build progress, Q&A, persistence after reload, desktop/mobile layouts, invalid request validation; no browser exceptions.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
