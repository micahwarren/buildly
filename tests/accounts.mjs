import { chromium } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const base = process.env.BASE_URL || "http://127.0.0.1:3001";
const host = "https://buildly-auth-test.supabase.co";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "homeowner@example.test",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.testsignature`;
const session = {
  access_token: token,
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
};
let signup = false,
  cloudFailure = false;
let cloudDelay = null;
const rows = new Map(),
  objects = new Map();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "buildly-accounts-"));
async function mock(context) {
  await context.route("**/auth/v1/**", (route) =>
    route.abort("blockedbyclient"),
  );
  await context.route(host + "/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method();
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    const json = (data, status = 200) =>
      route.fulfill({ status, headers, json: data });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/signup") {
      const body = req.postDataJSON();
      assert.equal(body.email, user.email);
      assert.ok(body.password.length >= 8);
      signup = true;
      return json({ user, session: null });
    }
    if (url.pathname === "/auth/v1/token") return json(session);
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/recover") return json({});
    if (req.headers().authorization !== `Bearer ${token}`)
      return json({ message: "Unauthorized" }, 401);
    if (url.pathname === "/rest/v1/projects") {
      if (method === "GET")
        return json(
          [...rows.values()].filter((row) => row.user_id === user.id),
        );
      if (method === "POST") {
        if (cloudFailure)
          return json({ code: "XX000", message: "Test cloud failure" }, 500);
        if (cloudDelay) await cloudDelay;
        const data = req.postDataJSON();
        assert.equal(data.user_id, user.id);
        assert.ok(data.payload.originalImage.startsWith(`storage:${user.id}/`));
        assert.ok(!JSON.stringify(data.payload).includes("data:image/"));
        rows.set(data.id, data);
        return json(null, 201);
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("id")?.slice(3);
        rows.delete(id);
        return route.fulfill({ status: 204, headers });
      }
    }
    if (url.pathname === "/storage/v1/object/list/project-images") {
      const body = req.postDataJSON();
      return json(
        [...objects.keys()]
          .filter((key) => key.startsWith(body.prefix + "/"))
          .map((key) => ({
            name: key.slice(body.prefix.length + 1),
            id: key,
            metadata: {},
          })),
      );
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      let key = url.pathname
        .replace("/storage/v1/object/", "")
        .replace(/^authenticated\//, "")
        .replace(/^project-images\//, "");
      key = decodeURIComponent(key);
      assert.ok(key.startsWith(user.id + "/"));
      if (method === "POST" || method === "PUT") {
        const request = new Request(req.url(), {
          method: "POST",
          headers: req.headers(),
          body: req.postDataBuffer(),
        });
        const form = await request.formData();
        const image = [...form.values()].find(
          (value) => typeof value !== "string",
        );
        assert.ok(image);
        objects.set(key, {
          bytes: Buffer.from(await image.arrayBuffer()),
          type: image.type,
        });
        return json({ Key: `project-images/${key}` });
      }
      if (method === "GET") {
        const image = objects.get(key);
        if (!image) return json({ message: "Not found" }, 404);
        return route.fulfill({
          headers: { ...headers, "Content-Type": image.type },
          body: image.bytes,
        });
      }
    }
    throw new Error("Unhandled mock request: " + method + " " + url.pathname);
  });
}
async function signIn(page) {
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByRole("button", { name: "My account", exact: true }).waitFor();
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await mock(context);
  if (process.env.NATIVE_TEST) {
    const bytes = await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: "#789966" },
    })
      .jpeg()
      .toBuffer();
    await context.addInitScript((data) => {
      window.webkit = { messageHandlers: { bridge: {} } };
      window.Capacitor = {
        PluginHeaders: [
          { name: "Camera", methods: [{ name: "getPhoto", rtype: "promise" }] },
        ],
        nativePromise: async () => ({ base64String: data, format: "jpeg" }),
      };
    }, bytes.toString("base64"));
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  if (process.env.NATIVE_TEST) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".native-login").waitFor();
    await page.screenshot({ path: "/tmp/buildly-native-login.png" });
    assert.equal(await page.locator(".hero").count(), 0);
    await page.getByLabel("Email address").fill(user.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-123");
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await page.locator(".native-dashboard").waitFor();
    await page.screenshot({ path: "/tmp/buildly-native-dashboard.png" });
    await page.getByRole("button", { name: "Create my first project" }).click();
    await page.locator(".native-tutorial").waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Add my photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose a photo", exact: true })
      .click();
    await page.getByAltText("Your uploaded project area").waitFor();
    assert.ok(
      (
        await page
          .getByAltText("Your uploaded project area")
          .getAttribute("src")
      ).startsWith("data:image/jpeg;base64,"),
    );
    await page.reload();
    await page.locator(".native-dashboard").waitFor();
    await page
      .getByRole("button", { name: "Start a project", exact: false })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Add a photo of your space" })
      .waitFor();
    assert.equal(await page.locator(".native-tutorial").count(), 0);
    const photoBytes = await sharp({
      create: { width: 640, height: 400, channels: 3, background: "#779955" },
    })
      .jpeg()
      .toBuffer();
    const response = await page.request.post(base + "/api/projects", {
      data: {
        mode: "demo",
        originalImage:
          "data:image/jpeg;base64," + photoBytes.toString("base64"),
        projectType: "Patio",
        description: "My saved backyard patio",
        width: 12,
        length: 16,
        budget: "Not sure",
        experienceLevel: "Beginner",
      },
    });
    assert.ok(response.ok());
    const savedProject = await response.json();
    const photoPath = `${user.id}/${savedProject.id}/original.jpg`;
    objects.set(photoPath, { bytes: photoBytes, type: "image/jpeg" });
    rows.set(savedProject.id, {
      id: savedProject.id,
      user_id: user.id,
      payload: { ...savedProject, originalImage: `storage:${photoPath}` },
    });
    await page.reload();
    await page.locator(".native-project-card").waitFor();
    await page.locator(".native-project-open").click();
    await page.getByRole("tab", { name: "Materials", exact: true }).waitFor();

    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.getByRole("button", { name: "My account", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.locator(".native-login").waitFor();
    assert.equal(await page.locator(".native-dashboard").count(), 0);
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      "PASS: native login, dashboard, first-project-only tutorial, base64 camera bridge, prepared upload preview, draft return, mobile fit and sign-out gate (mocked device/auth).",
    );
    return;
  }
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .click();
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByText(/Check your email to confirm/).waitFor();
  assert.equal(signup, true);
  await page
    .getByRole("button", { name: "Keep working on this device" })
    .click();
  await signIn(page);
  console.log("Account signup and sign-in passed");
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: { billingEnabled: true, imageGenerationAvailable: true },
    }),
  );
  await page.route("**/api/billing/status", (route) => {
    assert.equal(route.request().headers().authorization, `Bearer ${token}`);
    return route.fulfill({ json: { credits: 1 } });
  });
  await page.getByRole("button", { name: "My account", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Project purchases", exact: true })
    .click();
  await page.getByText("1 unused project credit", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  const photo = await sharp({
    create: { width: 640, height: 400, channels: 3, background: "#779955" },
  })
    .jpeg()
    .toBuffer();
  const response = await page.request.post(base + "/api/projects", {
    data: {
      mode: "demo",
      originalImage: "data:image/jpeg;base64," + photo.toString("base64"),
      projectType: "Patio",
      description: "A family patio in my backyard",
      width: 12,
      length: 16,
      budget: "Not sure",
      experienceLevel: "Beginner",
    },
  });
  assert.equal(response.status(), 200);
  const project = await response.json();
  const backup = path.join(folder, "project.json");
  fs.writeFileSync(
    backup,
    JSON.stringify({ format: "buildly-project-v1", project }),
  );
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await page.locator(".backup-actions").waitFor();
  await page.locator(".backup-actions input").setInputFiles(backup);
  await page.getByRole("heading", { name: "Here’s your project." }).waitFor();
  await page
    .locator(".project-save-bar")
    .getByText("Saved to your account", { exact: true })
    .waitFor();
  assert.equal(rows.size, 1);
  console.log("Cloud project upload passed");
  assert.ok(objects.size > 0);
  await page.getByRole("tab", { name: "Build steps", exact: true }).click();
  await page.getByRole("button", { name: "Done — next step" }).click();
  await page
    .locator(".project-save-bar")
    .getByText("Saved to your account", { exact: true })
    .waitFor();
  assert.equal(rows.get(project.id).payload.completed, 1);
  // Separate browser storage exercises cloud restoration, not the first device's IndexedDB.
  const context2 = await browser.newContext();
  await mock(context2);
  const other = await context2.newPage();
  await other.goto(base);
  await signIn(other);
  await other
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  await other.getByRole("button", { name: "Continue project" }).click();
  await other.getByRole("tab", { name: "Build steps", exact: true }).click();
  assert.match(
    await other.locator(".build-mode").innerText(),
    /1 \/ 7 complete/,
  );

  let release;
  cloudDelay = new Promise((resolve) => {
    release = resolve;
  });
  await page.getByRole("button", { name: "Done — next step" }).click();
  await page.getByRole("button", { name: "Done — next step" }).click();
  await page.waitForFunction(
    (userId) =>
      new Promise((resolve) => {
        const open = indexedDB.open("buildly", 1);
        open.onsuccess = () => {
          const req = open.result
            .transaction("projects", "readonly")
            .objectStore("projects")
            .getAll();
          req.onsuccess = () => {
            resolve(
              req.result.some(
                (record) =>
                  record.scope === userId && record.project.completed === 3,
              ),
            );
            open.result.close();
          };
        };
      }),
    user.id,
  );
  cloudDelay = null;
  release();
  await page
    .locator(".project-save-bar")
    .getByText("Saved to your account", { exact: true })
    .waitFor();
  assert.equal(rows.get(project.id).payload.completed, 3);
  cloudFailure = true;
  await page.getByRole("button", { name: "Done — next step" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Cloud saving failed" })
    .waitFor();
  assert.equal(rows.get(project.id).payload.completed, 3);
  assert.match(
    await page.locator(".project-save-bar").innerText(),
    /Saved automatically on this device/,
  );
  cloudFailure = false;
  await page.getByRole("button", { name: "My account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign in / Create account", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: /My projects/ })
    .first()
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Continue project" }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: Supabase SDK signup/email-confirmation UX, sign-in, private image upload, metadata save, progress sync, a separate browser restoring cloud projects, local preservation on cloud failure, and sign-out isolation (mocked Supabase; live policies/email unverified).",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
