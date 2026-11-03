import assert from "node:assert/strict";
import loadHighs from "highs";
import { canUse, features, requireFeature } from "../src/features";
import {
  solveAction,
  heatSheets,
  sessionTimeline,
  brandedPrint,
  type Request,
} from "../src/actions";
import { initialState, exportJSON, importJSON, checkState } from "../src/state";
import { solve } from "../src/solver";
import { compare, sequential } from "../src/sequential";
import { savingsDemo } from "../src/demo";
import { validate } from "../src/validator";
let checks = 0;
for (const tier of ["free", "pro"] as const)
  for (const feature of features) {
    const expected =
      tier === "pro" || ["roster", "relay", "lineups"].includes(feature);
    assert.equal(canUse(feature, tier), expected);
    checks++;
    if (!expected)
      assert.throws(() => requireFeature(feature, tier), /requires Pro/);
  }
let calls = 0;
const never: Request = async () => {
  calls++;
  throw Error("must not run");
};
const free = initialState();
await assert.rejects(solveAction(free, never), /requires Pro/);
assert.throws(() => heatSheets(free), /requires Pro/);
assert.throws(() => sessionTimeline(free), /requires Pro/);
assert.throws(
  () =>
    brandedPrint("free", () => {
      calls++;
    }),
  /requires Pro/,
);
assert.equal(calls, 0);
let printed = 0;
brandedPrint("pro", () => {
  printed++;
});
assert.equal(printed, 1);
console.log(
  `G13 PASS: ${checks}/${checks} feature/tier combinations; 4 forbidden action invocations rejected; 0 Worker/print side effects; Pro print allowed`,
);
const highs = await loadHighs();
const request: Request = async (input, comparison) =>
  comparison
    ? (() => {
        const joint = solve(input, highs);
        return { joint, comparison: compare(joint, sequential(input, highs)) };
      })()
    : { solution: solve(input, highs) };
const s = initialState();
s.input = savingsDemo();
const first = await solveAction(s, request, "r0");
const second = await solveAction(first, request, "r1");
assert.deepEqual(
  second.solution!.teams.filter((t) => t.team.relayId === "r0"),
  first.solution!.teams,
);
assert.deepEqual(validate(s.input, second.solution!.teams), []);
assert.equal(second.solution!.teams.length, 2);
assert.equal(second.solution!.status, "feasible");
const pro = structuredClone(s);
pro.tier = "pro";
const joint = await solveAction(pro, request);
assert.equal(joint.comparison!.savedCs, 26880);
assert.deepEqual(importJSON(exportJSON(joint)), joint);
for (const mutate of [
  (p: any) => (p.input.meet.laneOrder = [1, 1, 1, 1, 1, 1]),
  (p: any) => (p.input.meet.poolBooking.end = "17:00"),
  (p: any) => (p.input.swimmers[0].times.free50 = -1),
  (p: any) => (p.input.locks = [{ swimmerId: "missing" }]),
  (p: any) => (p.version = 2),
  (p: any) => (p.solution.teams[0].legs[0].cs = 1),
]) {
  const bad = structuredClone(joint);
  mutate(bad);
  assert.throws(() => importJSON(JSON.stringify(bad)));
}
checkState(second);
console.log(
  "UI state PASS: 2 sequential relays preserve accepted teams and caps; independent validator clean; Pro saves 26880 cs; JSON deep-equal; 6 malformed backups rejected",
);
