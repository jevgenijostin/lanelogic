import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage();
 const errors: string[] = [];
 page.on('pageerror', e => errors.push(String(e)));
 await page.goto('http://127.0.0.1:4173');
 for (const [constraint, expected] of [['x <= 1','Optimal'], ['x >= 2','Infeasible']]) {
  const start = performance.now();
  const result: any = await page.evaluate(async lp => (window as any).solveLP(lp), `Maximize\n obj: x\nSubject To\n c: ${constraint}\nBinary\n x\nEnd`);
  assert.equal(result.status, expected, JSON.stringify(result));
  console.log(`G0 ${expected}: PASS (${Math.round(performance.now()-start)} ms)`);
 }
 assert.deepEqual(errors, []);
} finally { await browser.close(); }
