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
  for (const viewport of [
    { width: 1440, height: 780 },
    { width: 1280, height: 650 },
    { width: 1512, height: 820 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    for (const selector of [
      ".home-simple .hero",
      ".hero-copy .primary",
      ".deck-scene",
    ]) {
      const box = await page.locator(selector).boundingBox();
      assert(
        box && box.y >= 0 && box.y + box.height <= viewport.height + 1,
        `${selector} must fit at ${viewport.width}x${viewport.height}`,
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  const endings = page.locator(".headline-endings em");
  for (const [index, time] of [1000, 6000, 11000, 16000, 21000].entries()) {
    const visible = await endings.evaluateAll((elements, time) => {
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
    assert.equal(visible.filter((opacity) => opacity === 1).length, 1);
    assert.equal(visible[index % 4], 1);
  }
  for (const width of [375, 390, 980, 1280, 1440]) {
    await page.setViewportSize({ width, height: 780 });
    assert(
      await endings.evaluateAll((elements) =>
        elements.every((element) => element.scrollWidth <= element.clientWidth),
      ),
      `headline must fit at ${width}`,
    );
  }
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
