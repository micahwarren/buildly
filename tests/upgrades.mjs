import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "buildly-upgrades-"));
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const now = new Date().toISOString();
const project = {
  id: "upgrade-fixture",
  title: "Wooden patio and pergola",
  projectType: "Patio",
  description: "A wooden patio and freestanding cedar pergola",
  originalImage: photo,
  generatedImage: photo,
  visualizationMode: "ai",
  width: 12,
  length: 16,
  budget: "$5,000+",
  experienceLevel: "Beginner",
  details: {
    height: "18 inches",
    material: "Cedar",
    attachment: "Freestanding",
  },
  estimatedCostLow: 1000,
  estimatedCostHigh: 2000,
  estimatedHours: "100–160 person-hours",
  difficulty: "Advanced",
  recommendedCrew: "3 people",
  planStatus: "design-based",
  planSummary: "Wood platform with cedar pergola",
  planQuestions: ["Confirm the footing design"],
  materials: [
    {
      item: "Exterior screws",
      quantity: 212,
      quantityUnit: "each",
      dimensions: "Compatible exterior screws",
      unitCost: 0.12,
      purpose: "Fasten wood decking",
      quantityBasis: "Two per intersection plus waste",
      purchase: {
        label: "100-count box",
        coverage: 100,
        notes: "Confirm treatment compatibility and length",
      },
    },
  ],
  tools: ["Tape measure"],
  steps: Array.from({ length: 8 }, (_, i) => ({
    title: `Step ${i + 1}`,
    text: "Coordinate the wood platform and pergola.",
    actions: [
      "Mark the footprint",
      "Measure both diagonals",
      "Record the dimensions",
    ],
    materials: ["Exterior screws"],
    tools: ["Tape measure"],
    checks: ["Diagonals agree"],
    stopConditions: ["Resolve the footing design first"],
  })),
  assumptions: ["Verify dimensions"],
  warnings: ["Professional design review required"],
  completed: 0,
  createdAt: now,
  updatedAt: now,
  status: "concept",
  demo: true,
  conversation: [],
};
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((p) => {
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem("buildly-projects", JSON.stringify([p]));
      localStorage.setItem("seeded", "yes");
    }
  }, project);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseUrl);
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue project" }).click();
  await page.getByRole("tab", { name: "Materials", exact: true }).click();
  const row = page.locator(".shopping-item").first();
  assert.match(await row.innerText(), /3 × 100-count box/);
  await row
    .getByText("Select package and record a quote", { exact: true })
    .click();
  await row.getByLabel("Your price per package (USD)").fill("12.50");
  await row.getByLabel("Supplier", { exact: true }).fill("Local lumber yard");
  await row
    .getByLabel("Product link (optional)")
    .fill("https://example.com/screws");
  await row.getByRole("button", { name: "Save package and quote" }).click();
  await row.getByText("$37.50", { exact: true }).waitFor();
  await row
    .getByRole("checkbox", { name: "Purchased Exterior screws" })
    .check();
  await page.getByRole("tab", { name: "Project details", exact: true }).click();
  await page.getByLabel("Reviewer name / role").fill("Alex — builder");
  await page
    .getByLabel("Findings and changes required")
    .fill("Verify post footing design before purchase.");
  await page.getByLabel("Site dimensions and heights measured").check();
  await page.getByRole("button", { name: "Save review notes" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Review notes saved" })
    .waitFor();
  const packet = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download builder review packet" })
    .click();
  const packetPath = path.join(artifacts, "review.html");
  await (await packet).saveAs(packetPath);
  assert.match(fs.readFileSync(packetPath, "utf8"), /Alex — builder/);
  await page.route("**/api/ask", (route) => {
    const sent = route.request().postDataJSON();
    assert.equal(sent.project.details.height, "18 inches");
    assert.equal(sent.project.originalImage, "");
    return route.fulfill({
      json: {
        answer:
          "Your footing design is unresolved. Confirm it before digging; use Refine this project to apply scope changes.",
        demo: false,
      },
    });
  });
  await page
    .getByRole("tab", { name: "Ask about my project", exact: true })
    .click();
  await page.getByLabel("Your question").fill("What is my next step?");
  await page.locator(".assistant form").getByRole("button").click();
  await page.getByText("Buildly AI", { exact: true }).waitFor();
  assert.match(
    await page.locator(".message").last().innerText(),
    /footing design/,
  );
  await page.waitForFunction(() =>
    document.body.innerText.includes("Saved automatically on this device"),
  );
  await page.reload();
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue project" }).click();
  await page.getByRole("tab", { name: "Materials", exact: true }).click();
  assert.ok(
    await page
      .getByRole("checkbox", { name: "Purchased Exterior screws" })
      .isChecked(),
  );
  await page.getByText("Refine this project", { exact: true }).click();
  await page
    .getByText("Update site details or answer planning questions", {
      exact: true,
    })
    .click();
  await page.locator("#refinement-location").fill("Madison, Wisconsin");
  await page.route("**/api/plan", (route) => {
    const sent = route.request().postDataJSON();
    assert.equal(sent.details.location, "Madison, Wisconsin");
    return route.fulfill({
      json: {
        ...project,
        details: sent.details,
        shopping: [],
        review: undefined,
        completed: 0,
        updatedAt: new Date().toISOString(),
      },
    });
  });
  await page
    .getByRole("button", { name: "Update details and rebuild plan only" })
    .click();
  await page.getByText("No quotes yet", { exact: false }).waitFor();
  await page
    .getByLabel("What would you like to change?")
    .fill("Make it two feet wider");
  await page.route("**/api/refine", (route) => {
    const sent = route.request().postDataJSON();
    assert.equal(sent.change, "Make it two feet wider");
    assert.equal(sent.details.location, "Madison, Wisconsin");
    return route.fulfill({
      json: {
        ...project,
        id: "revision-fixture",
        parentProjectId: project.id,
        title: "Revised wood patio",
        description: "14 × 16 wooden patio and pergola",
        width: 14,
        details: sent.details,
        shopping: [],
        review: undefined,
        conversation: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  });
  await page
    .getByRole("button", { name: "Create revised design and plan" })
    .click();
  await page.getByRole("heading", { name: /Your 14 × 16/ }).waitFor();
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Continue project" }).count(),
    2,
  );
  await page.getByRole("button", { name: "Continue project" }).first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Materials", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(artifacts, "shopping-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: package rounding, quote totals, purchase persistence, review packet, real-chat UI, follow-up answers, plan rebuild clearing stale quotes, separate revision preservation, mobile layout. Artifacts: " +
      artifacts,
  );
} finally {
  await browser.close();
}
