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
  // Browser tests never call a paid image provider.
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { imageGenerationAvailable: false } }),
  );
  await page.route("**/api/design", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Photo previews are not connected yet." },
    }),
  );
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
  await page.getByText("Draft saved on this device", { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel("Tell us what you’re imagining").waitFor();
  assert.equal(
    await page.getByLabel("Tell us what you’re imagining").inputValue(),
    "A cedar pergola for family dinners in our backyard.",
  );
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
  await page
    .getByRole("button", {
      name: "Explore a sample plan instead (no photo edit)",
    })
    .click();
  await page.getByRole("heading", { name: "Here’s your project." }).waitFor();
  assert.match(await page.locator(".result-heading").innerText(), /14 × 18/);
  // The result must survive a refresh without the old manual Save action.
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("buildly", 1);
        open.onsuccess = () => {
          const req = open.result
            .transaction("drafts", "readonly")
            .objectStore("drafts")
            .get("guest");
          req.onsuccess = () => {
            resolve(req.result?.view === "result");
            open.result.close();
          };
        };
      }),
  );
  await page.reload();
  await page.getByRole("heading", { name: "Here’s your project." }).waitFor();
  assert.match(await page.locator(".result-heading").innerText(), /14 × 18/);

  assert.equal(await page.getByRole("slider").count(), 0);
  await page
    .getByRole("button", { name: "Create a photo preview", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Photo previews are not connected yet" })
    .waitFor();
  await page.getByRole("button", { name: "Dismiss error" }).click();
  assert.equal(await page.locator(".sample-images").count(), 1);
  await page.unroute("**/api/design");
  const fixtureImage =
    "data:image/png;base64," +
    fs.readFileSync(path.join(output, "yard.png")).toString("base64");
  await page.route("**/api/design", (route) =>
    route.fulfill({
      json: { generatedImage: fixtureImage, visualizationMode: "ai" },
    }),
  );
  await page
    .getByRole("button", { name: "Create a photo preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Your design", exact: true })
    .waitFor();
  assert.equal(await page.locator(".sample-images").count(), 0);
  assert.equal(await page.getByRole("slider").count(), 0);
  assert.equal(
    await page.locator(".comparison>img").getAttribute("src"),
    fixtureImage,
  );
  await page.getByRole("button", { name: "Compare before & after" }).click();
  await page.getByRole("slider").fill("30");
  assert.match(
    await page.locator(".before-image").getAttribute("style"),
    /70%/,
  );
  const sizes = await page.locator(".comparison").evaluate((el) => ({
    width: el.clientWidth,
    originalWidth: el.querySelector(".before-image img").clientWidth,
  }));
  assert.ok(Math.abs(sizes.width - sizes.originalWidth) < 2);
  await page.getByRole("button", { name: "Your design", exact: true }).click();

  await page
    .getByRole("button", { name: "Save my project", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page
    .getByRole("button", { name: "Keep on this device", exact: true })
    .click();
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

  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download project backup", exact: true })
    .click();
  const backupDownload = await exported;
  const backupPath = path.join(output, "project-backup.json");
  await backupDownload.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.equal(backup.format, "buildly-project-v1");
  assert.equal(backup.project.completed, 1);
  const legacyContext = await browser.newContext();
  await legacyContext.addInitScript(
    (project) =>
      localStorage.setItem("buildly-projects", JSON.stringify([project])),
    backup.project,
  );
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(BASE_URL);
  await legacyPage
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await legacyPage.getByRole("button", { name: "Continue project" }).waitFor();
  legacyPage.on("dialog", (dialog) => dialog.accept());
  await legacyPage
    .getByRole("button", { name: "Remove project", exact: true })
    .click();
  await legacyPage
    .getByRole("heading", { name: "Every great project starts with an idea." })
    .waitFor();
  await legacyPage.reload();
  await legacyPage
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await legacyPage
    .getByRole("heading", { name: "Every great project starts with an idea." })
    .waitFor();
  assert.equal(
    await legacyPage.getByRole("button", { name: "Continue project" }).count(),
    0,
  );
  await legacyContext.close();
  const bad = await page.request.post(BASE_URL + "/api/projects", {
    data: { description: "x" },
  });
  assert.equal(bad.status(), 400);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: upload, wizard, dimensions, draft recovery, automatic result recovery before manual save, backup export, legacy migration and deletion, explicit demo, missing-key error UI, live-result UI and comparison (mocked provider), materials download, tools, build progress, Q&A, persistence after reload, desktop/mobile layouts, invalid request validation; no browser exceptions.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
