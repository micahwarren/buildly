import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || undefined,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(process.env.BASE_URL || "http://localhost:3006");
  await page.locator(".deck-piece").first().waitFor({ state: "attached" });
  const sample = async (time) =>
    page.locator(".deck-piece").evaluateAll((elements, time) => {
      elements.forEach((element) =>
        element.getAnimations().forEach((animation) => {
          animation.pause();
          animation.currentTime = time;
        }),
      );
      return elements.map((element) =>
        Number(getComputedStyle(element).opacity),
      );
    }, time);
  assert((await sample(100)).every((opacity) => opacity === 0));
  const midway = await sample(4000);
  assert(
    midway.some((opacity) => opacity === 1) &&
      midway.some((opacity) => opacity === 0),
  );
  assert((await sample(9500)).every((opacity) => opacity === 1));
  assert((await sample(11900)).every((opacity) => opacity === 0));
  await sample(9500);
  await page.screenshot({ path: "/tmp/deck-home.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/deck-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert(
    await page
      .locator(".deck-piece")
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            getComputedStyle(element).animationName === "none" &&
            getComputedStyle(element).opacity === "1",
        ),
      ),
  );
  console.log(
    "PASS: deck assembles progressively, holds, resets; mobile fits; reduced-motion shows complete deck.",
  );
} finally {
  await browser.close();
}
