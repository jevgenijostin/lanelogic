import { chromium, expect, type Page } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { STORAGE_KEY, type AppState } from "../src/state";
import { DISCLAIMER } from "../src/ui";
import { validate } from "../src/validator";
await mkdir("reports/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  const external: string[] = [];
  const workerUrls: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  context.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !== "http://127.0.0.1:4173"
    )
      external.push(r.url());
  });
  page.on("worker", (w) => workerUrls.push(w.url()));
  const nav = async (i: number) => {
    await page.locator(`[data-screen="${i}"]`).click();
    await expect(page.locator("#screen")).toHaveAttribute(
      "data-view",
      String(i),
    );
  };
  const saved = async (): Promise<AppState> =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const importBackup = async (text: string) => {
    await page
      .locator("#json-file")
      .setInputFiles({
        name: "meet.json",
        mimeType: "application/json",
        buffer: Buffer.from(text),
      });
    await expect(page.locator("#notice")).toContainText(
      "imported and validated",
    );
  };
  let disclaimerChecks = 0;
  const checkDisclaimer = async (selector: string) => {
    const loc = page.locator(selector);
    assert.ok(await loc.count());
    for (let i = 0; i < (await loc.count()); i++) {
      await expect(loc.nth(i)).toContainText(DISCLAIMER);
      disclaimerChecks++;
    }
  };
  await page.goto("http://127.0.0.1:4173");
  await expect(page.locator(".roster-table tbody tr")).toHaveCount(40);
  await page.screenshot({
    path: "reports/screenshots/roster.png",
    fullPage: true,
  });
  await nav(1);
  await checkDisclaimer("[data-seeding-view]");
  await expect(page.locator('[data-meet="circleHeats"]')).toBeDisabled();
  await nav(2);
  await expect(page.locator('[data-action="solve-all"]')).toBeDisabled();
  await nav(3);
  await checkDisclaimer("#screen");
  await expect(page.locator("[data-heat-event]")).toHaveCount(0);
  await page.locator("#tier").selectOption("pro");
  await checkDisclaimer("#screen");
  await checkDisclaimer("[data-heat-event]");
  await nav(1);
  await checkDisclaimer("[data-seeding-view]");
  await page.screenshot({
    path: "reports/screenshots/setup.png",
    fullPage: true,
  });
  await nav(2);
  // Observe actual busy UI and click its ping button on the main thread while the real Worker solves.
  await page.evaluate(() => {
    const w = window as any;
    w.pings = [];
    w.solveStarted = performance.now();
    w.pingTimer = setInterval(() => {
      const strip = document.querySelector<HTMLElement>(".solve-strip");
      if (strip && !strip.hidden) {
        const before = performance.now();
        document.querySelector<HTMLButtonElement>("#ping")!.click();
        w.pings.push({
          latency: performance.now() - before,
          text: document.querySelector("#pong")!.textContent,
        });
      }
    }, 10);
  });
  const started = performance.now();
  await page.locator('[data-action="solve-all"]').click();
  await expect(page.locator("#notice")).toContainText(/optimal.*12 teams/, {
    timeout: 10000,
  });
  const duration = performance.now() - started;
  const pings = await page.evaluate(() => {
    clearInterval((window as any).pingTimer);
    return (window as any).pings as { latency: number; text: string }[];
  });
  const solved = await saved();
  assert.equal(solved.input.swimmers.length, 40);
  assert.equal(solved.input.relays.length, 6);
  assert.equal(solved.solution!.teams.length, 12);
  assert.deepEqual(validate(solved.input, solved.solution!.teams), []);
  assert.ok(duration < 10000);
  assert.ok(pings.length > 0);
  assert.ok(pings.every((p) => p.text.includes("during solve")));
  const maxPing = Math.max(...pings.map((p) => p.latency));
  assert.ok(maxPing < 100);
  assert.equal(workerUrls.length, 1);
  assert.match(workerUrls[0], /assets\/worker-.*\.js/);
  assert.deepEqual(external, []);
  console.log(
    `G11 PASS: built app; 40 swimmers / 6 relays / 12 teams; optimal + independent validator clean; ${duration.toFixed(1)} ms click-to-result including joint/sequential comparison; ${pings.length} in-solve UI pings, max ${maxPing.toFixed(2)} ms; ${workerUrls.length} bundled Worker; ${external.length} external requests`,
  );
  await expect(page.locator(".team-card")).toHaveCount(12);
  await page.screenshot({
    path: "reports/screenshots/lineups.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  const download = await downloadPromise;
  const json = await readFile((await download.path())!, "utf8");
  assert.deepEqual(JSON.parse(json), solved);
  await nav(0);
  await page
    .locator('[data-swimmer="0"][data-field="name"]')
    .fill("Changed swimmer");
  await page.locator('[data-swimmer="0"][data-field="name"]').press("Tab");
  assert.notDeepEqual(await saved(), solved);
  await importBackup(json);
  assert.deepEqual(await saved(), solved);
  await page.reload();
  assert.deepEqual(await saved(), solved);
  await expect(
    page.locator('[data-swimmer="0"][data-field="name"]'),
  ).toHaveValue(solved.input.swimmers[0].name);
  console.log(
    `G12 PASS: ${Buffer.byteLength(json)}-byte downloaded JSON imported through file control, deep-equal to original ${solved.input.swimmers.length}-swimmer state including 12 lineups; localStorage + reload deep-equal`,
  );
  await nav(3);
  await checkDisclaimer("#screen");
  await checkDisclaimer("[data-heat-event]");
  await expect(page.locator(".heat")).toHaveCount(6);
  await page.screenshot({
    path: "reports/screenshots/heats.png",
    fullPage: true,
  });
  await page.locator('[data-action="print-preview"]').click();
  await checkDisclaimer("dialog");
  await checkDisclaimer("dialog [data-heat-event]");
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  // Exercise the real print action, replacing only the native dialog with its browser event.
  await page.evaluate(() => {
    (window as any).printCalls = 0;
    window.print = () => {
      (window as any).printCalls++;
      window.dispatchEvent(new Event("beforeprint"));
    };
  });
  await page.locator('[data-action="print"]').click();
  assert.equal(await page.evaluate(() => (window as any).printCalls), 1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#print-root")).toBeVisible();
  await checkDisclaimer("#print-root");
  await checkDisclaimer("#print-root [data-heat-event]");
  await expect(page.locator(".workspace")).toBeHidden();
  await page.pdf({ path: "reports/heat-sheets.pdf", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await nav(4);
  await expect(page.locator("#overrun")).toContainText("to spare");
  await page.screenshot({
    path: "reports/screenshots/timeline.png",
    fullPage: true,
  });
  await nav(5);
  await page.screenshot({
    path: "reports/screenshots/about.png",
    fullPage: true,
  });
  // Circle variants render their own disclaimer; changing setup invalidates stale lineups.
  for (const circle of ["2", "3"]) {
    await nav(1);
    await page.locator('[data-meet="circleHeats"]').selectOption(circle);
    await checkDisclaimer("[data-seeding-view]");
    await nav(3);
    await checkDisclaimer("#screen");
    await checkDisclaimer("[data-heat-event]");
  }
  await page.locator("#tier").selectOption("free");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await checkDisclaimer("#print-root");
  await expect(page.locator("#print-root [data-heat-event]")).toHaveCount(0);
  console.log(
    `G14 PASS: ${disclaimerChecks} disclaimer assertions across free/pro seeding, locked/empty/populated heat sheets, circle 0/2/3 settings, print preview, each printed event and Free browser-print fallback; print CSS + PDF rendered`,
  );
  // Editing, CSV failure atomicity, malformed backup rejection, and small-screen overflow.
  await nav(0);
  const beforeCSV = await saved();
  await page
    .locator("#csv-file")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "id,name,sex,dob,individualEntries,free50\nx,Wrong,M,2010-01-01,0,bad\n",
      ),
    });
  await expect(page.locator("#notice")).toContainText("Row 2");
  assert.deepEqual(await saved(), beforeCSV);
  await page
    .locator("#csv-file")
    .setInputFiles({
      name: "good.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "id,name,sex,dob,individualEntries,free50\nx,New swimmer,F,2010-01-01,0,NT\n",
      ),
    });
  await expect(page.locator(".roster-table tbody tr")).toHaveCount(1);
  assert.deepEqual((await saved()).input.swimmers[0].times, {});
  await page.locator('[data-time="free50"]').fill("28.45");
  await page.locator('[data-time="free50"]').press("Tab");
  assert.equal((await saved()).input.swimmers[0].times.free50, 2845);
  await page.locator('[data-time="free50"]').fill("NT");
  await page.locator('[data-time="free50"]').press("Tab");
  assert.deepEqual((await saved()).input.swimmers[0].times, {});
  const beforeBad = await saved();
  await page
    .locator("#json-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.locator("#notice")).toContainText("not imported");
  assert.deepEqual(await saved(), beforeBad);
  await importBackup(json);
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 6; i++) {
    await nav(i);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, `Screen ${i} overflows at 390px`);
  }
  await nav(0);
  await page.screenshot({
    path: "reports/screenshots/mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "UI browser PASS: all 6 screens at 1440px and 390px; CSV invalid-row atomic rejection + NT/time editing; malformed JSON preserved state; 0 page errors; 0 external requests throughout",
  );
} finally {
  await browser.close();
}
