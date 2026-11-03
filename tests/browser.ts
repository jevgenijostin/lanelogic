import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { representative, fixture } from "./fixtures";
import { validate } from "../src/validator";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:4173/engine.html");
  for (const [constraint, expected] of [
    ["x <= 1", "Optimal"],
    ["x >= 2", "Infeasible"],
  ]) {
    const start = performance.now();
    const result: any = await page.evaluate(
      async (lp) => (window as any).solveLP(lp),
      `Maximize\n obj: x\nSubject To\n c: ${constraint}\nBinary\n x\nEnd`,
    );
    assert.equal(result.status, expected, JSON.stringify(result));
    console.log(
      `G0 ${expected}: PASS (${Math.round(performance.now() - start)} ms)`,
    );
  }
  const p = representative();
  const started = performance.now();
  const result: any = await page.evaluate(
    async (input) => (window as any).solveMeet(input, { timeS: 8 }),
    p,
  );
  assert.ok(result.solution, JSON.stringify(result));
  assert.ok(["optimal", "feasible"].includes(result.solution.status));
  assert.deepEqual(validate(p, result.solution.teams), []);
  assert.equal(result.solution.teams.length, 12);
  console.log(
    `G0 representative: PASS (40 swimmers, 6 relays, 12 teams; ${result.solution.status}; ${Math.round(performance.now() - started)} ms)`,
  );
  let baseline = "";
  for (let restart = 0; restart < 2; restart++) {
    if (restart) await page.reload();
    for (let i = 0; i < 20; i++) {
      const r: any = await page.evaluate(
        async (input) => (window as any).solveMeet(input),
        fixture(),
      );
      const json = JSON.stringify(r.solution);
      if (!baseline) baseline = json;
      assert.equal(json, baseline);
    }
  }
  console.log(
    "G7 Worker: PASS (20 runs x 2 Worker lifetimes, byte-identical solution JSON)",
  );
  await page.locator("#compare").click();
  await expect(page.locator("#savings")).toHaveText(
    "Joint vs sequential: 268.80 s saved",
  );
  await expect(page.locator("#checks")).toContainText("PASS");
  console.log(
    "G6 browser PASS: built harness banner shows exactly 268.80 s saved; independent checks PASS",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
