import loadHighs from "highs";
import assert from "node:assert/strict";
import { solve } from "../src/solver";
import { oracle } from "./oracle";
import { random, fixture, representative } from "./fixtures";
import { validate } from "../src/validator";
import { age, type Input, type Lineup } from "../src/domain";
import { parseTime, formatTime, importCSV } from "../src/parsing";
import { seed, LANE_ORDER } from "../src/seeding";
import { timeline } from "../src/timeline";
import { sequential, compare } from "../src/sequential";
const highs = await loadHighs();
const start = performance.now();
const sizes = new Set<number>();
let oracleFeasible = 0,
  oracleInfeasible = 0,
  oracleTeams = 0;
for (let i = 1; i <= 500; i++) {
  const p = random(i);
  sizes.add(p.swimmers.length);
  const expected = oracle(p);
  const actual = solve(p, highs, {}, false);
  assert.equal(actual.status === "infeasible", expected === null, `seed ${i}`);
  if (expected) {
    oracleFeasible++;
    oracleTeams += actual.teams.length;
    assert.equal(actual.status, "optimal");
    assert.equal(actual.stats.weight, expected.weight, `weight seed ${i}`);
    assert.equal(actual.stats.costCs, expected.costCs, `cost seed ${i}`);
  } else oracleInfeasible++;
  if (i % 100 === 0) console.log(`G3 progress ${i}/500`);
}
assert.deepEqual(
  [...sizes].sort((a, b) => a - b),
  [6, 7, 8, 9, 10],
);
assert.ok(oracleFeasible > 0 && oracleInfeasible > 0 && oracleTeams > 0);
console.log(
  `G3 PASS: 500/500 oracle objectives and verdicts matched; swimmers 6–10, teams 2–3; ${oracleFeasible} feasible / ${oracleInfeasible} infeasible / ${oracleTeams} fielded teams (${Math.round(performance.now() - start)} ms)`,
);

assert.equal(parseTime("28.45"), 2845);
assert.equal(parseTime("1:02.34"), 6234);
assert.equal(parseTime("NT"), undefined);
for (const s of [
  "",
  "NaN",
  "-1",
  "1:60.00",
  "1.234",
  "0.00",
  "2:3",
  "Infinity",
  "1e3",
  "1:2.34",
])
  assert.throws(() => parseTime(s));
for (let cs = 1; cs <= 20000; cs++) assert.equal(parseTime(formatTime(cs)), cs);
const csv =
  'id,name,sex,dob,individualEntries,free50\na,"A, B",M,2010-01-01,0,28.45\nb,B,F,2011-01-01,1,NT';
assert.equal(importCSV(csv).swimmers.length, 2);
assert.deepEqual(importCSV(csv).errors, []);
const bad = importCSV(
  csv.replace("28.45", "bad").replace("2011-01-01", "2011-02-30"),
);
assert.equal(bad.swimmers.length, 0);
assert.ok(bad.errors[0].startsWith("Row 2:"));
assert.ok(bad.errors[1].startsWith("Row 3:"));
assert.equal(age("2010-06-02", "2026-06-01"), 15);
assert.equal(age("2010-06-01", "2026-06-01"), 16);
console.log(
  "G1 PASS: 20000 integer-cs round trips; 3 required formats; 10 malformed inputs; CSV valid and row-2/3 rejection",
);

const base = fixture();
const clean = solve(base, highs);
assert.deepEqual(validate(base, clean.teams), []);
function caught(rule: string, change: (p: Input, t: Lineup[]) => void) {
  const p = structuredClone(base),
    t = structuredClone(clean.teams);
  change(p, t);
  assert.ok(
    validate(p, t).some((s) => s.startsWith(rule)),
    `${rule}: ${validate(p, t)}`,
  );
}
caught("C1", (_, t) => t[0].legs.pop());
caught("C2", (_, t) => (t[0].legs[1].swimmerId = t[0].legs[0].swimmerId));
caught("C3", (_, t) => (t[1].legs[0].swimmerId = t[0].legs[0].swimmerId));
caught("C4", (p) => (p.meet.relayLimitPerSwimmer = 0));
caught("C5", (_, t) => t.splice(0, 1));
caught("C6", (p) => p.swimmers.forEach((s) => (s.sex = "M")));
caught("C7", (p) => (p.relays[0].ageSumMax = 1));
caught("C8", (p, t) =>
  p.locks.push({
    mode: "ban",
    swimmerId: t[0].legs[0].swimmerId,
    team: t[0].team,
    leg: 0,
  }),
);
caught("C8", (p, t) =>
  p.locks.push({ mode: "pin", swimmerId: "missing", team: t[0].team, leg: 0 }),
);
caught("eligibility", (p) => (p.relays[0].gender = "M"));
caught("eligibility", (p) => (p.relays[0].ageMin = 20));
caught("eligibility", (p) => p.swimmers.forEach((s) => (s.times = {})));
caught("reporting", (_, t) => t[0].totalCs++);
console.log(
  "G2 PASS: clean lineup; 13 injected violations caught (C1–C8, sex, age, NT, reporting)",
);

const fuzzStart = performance.now();
let feasible = 0,
  infeasible = 0,
  fielded = 0;
for (let i = 1001; i <= 3000; i++) {
  const p = random(i);
  const out = solve(p, highs, {}, false);
  if (out.status === "infeasible") {
    infeasible++;
    assert.equal(out.teams.length, 0);
  } else {
    feasible++;
    fielded += out.teams.length;
    assert.deepEqual(validate(p, out.teams), [], `seed ${i}`);
  }
  if (i % 500 === 0) console.log(`G4 progress ${i - 1000}/2000`);
}
console.log(
  `G4 PASS: 2000 fuzz instances; ${feasible} feasible, ${infeasible} infeasible, ${fielded} teams; 0 validator violations (${Math.round(performance.now() - fuzzStart)} ms)`,
);

const locked = fixture();
locked.locks = [
  { swimmerId: "s0", team: { relayId: "r0", slot: 0 }, leg: 0, mode: "pin" },
  { swimmerId: "s1", team: { relayId: "r0", slot: 0 }, leg: 1, mode: "ban" },
];
assert.deepEqual(validate(locked, solve(locked, highs).teams), []);
const conflict = structuredClone(locked);
conflict.locks.push({ ...conflict.locks[0], swimmerId: "s2" });
const failed = solve(conflict, highs);
assert.equal(failed.status, "infeasible");
assert.ok(failed.diagnostics.includes("locks"));
for (const family of ["caps", "age bands", "eligibility"]) {
  const p = structuredClone(locked);
  if (family === "caps") p.meet.relayLimitPerSwimmer = 0;
  if (family === "age bands") p.relays[0].ageMin = 30;
  if (family === "eligibility") delete p.swimmers[0].times.free50;
  const s = solve(p, highs);
  assert.equal(s.status, "infeasible");
  assert.ok(s.diagnostics.includes(family), `${family}: ${s.diagnostics}`);
}
console.log(
  "G5 PASS: pin + ban honored; conflicting pins infeasible; locks/caps/age bands/eligibility relaxations identified",
);
const overCap = fixture();
overCap.swimmers[0].individualEntries = 4;
assert.equal(solve(overCap, highs).status, "infeasible");
assert.ok(validate(overCap, []).some((e) => e.startsWith("C4")));
const noTeams = fixture();
noTeams.relays = [];
assert.equal(solve(noTeams, highs).status, "optimal");
const adjustment = fixture();
adjustment.meet.startSplitAdjustCs = 0;
assert.equal(solve(adjustment, highs).stats.costCs, clean.stats.costCs);
console.log(
  "Boundary checks PASS: C4 pre-existing over-cap is infeasible; empty meet optimal; split adjustment leaves objective unchanged",
);

const advantage = fixture(8);
advantage.meet.relayLimitPerSwimmer = 1;
advantage.meet.startSplitAdjustCs = 0;
advantage.swimmers.forEach((s, i) => {
  s.sex = "M";
  s.times = {
    free50: 1000 + i * 10,
    ...(i < 4 ? { back50: 1000, breast50: 1000, fly50: 1000 } : {}),
  };
});
advantage.relays = [
  {
    id: "r0",
    name: "Free",
    kind: "free",
    gender: "M",
    legDist: 50,
    teams: 1,
    priority: 2,
  },
  {
    id: "r1",
    name: "Medley",
    kind: "medley",
    gender: "M",
    legDist: 50,
    teams: 1,
    priority: 1,
  },
];
const joint = solve(advantage, highs),
  seq = sequential(advantage, highs);
assert.equal(joint.teams.length, 2);
assert.equal(seq.teams.length, 1);
assert.equal(compare(joint, seq).additionalTeams, 1);
assert.equal(compare(joint, seq).savedCs, null);
const savings = structuredClone(advantage);
savings.swimmers.forEach((s, i) => {
  if (i >= 4) {
    s.times.back50 = 10000;
    s.times.breast50 = 10000;
    s.times.fly50 = 10000;
  }
});
const joint2 = solve(savings, highs),
  seq2 = sequential(savings, highs);
assert.equal(joint2.teams.length, 2);
assert.equal(seq2.teams.length, 2);
assert.equal(joint2.stats.costCs, 8220);
assert.equal(seq2.stats.costCs, 35100);
assert.equal(oracle(savings)!.costCs, 8220);
assert.equal(compare(joint2, seq2).savedCs, 26880);
console.log(
  `G6 engine PASS: joint 2 teams vs sequential 1; equal-coverage fixture saves ${compare(joint2, seq2).savedCs} cs (${compare(joint2, seq2).savedCs! / 100} s). Banner covered by browser gate`,
);

const json = JSON.stringify(clean);
for (let i = 0; i < 20; i++)
  assert.equal(JSON.stringify(solve(base, highs)), json);
console.log("G7 Node PASS: 20/20 byte-identical solution JSON");
for (const limits of [{ timeS: 0 }, { nodes: 0 }]) {
  const p = representative();
  const s = solve(p, highs, limits, false);
  assert.ok(
    ["feasible", "no_solution_found"].includes(s.status),
    `${JSON.stringify(limits)}: ${s.status}`,
  );
  if (s.status === "feasible") assert.deepEqual(validate(p, s.teams), []);
  console.log(`G8 PASS: ${JSON.stringify(limits)} => ${s.status}`);
}

const entries = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    seedCs: 1000 + i * 100,
    entryOrder: i,
  }));
const ids = (n: number, l: 4 | 6 | 8 | 10, c: 0 | 2 | 3 = 0) =>
  seed(entries(n), l, c).map((h) => h.lanes.map((l) => +l.entry.id.slice(1)));
assert.deepEqual(ids(3, 6), [[0, 1, 2]]);
assert.deepEqual(ids(6, 6), [[0, 1, 2, 3, 4, 5]]);
assert.deepEqual(ids(7, 6), [
  [4, 5, 6],
  [0, 1, 2, 3],
]);
assert.deepEqual(ids(8, 6), [
  [5, 6, 7],
  [0, 1, 2, 3, 4],
]);
assert.deepEqual(ids(13, 6, 3), [
  [2, 5, 8],
  [1, 4, 7, 10],
  [0, 3, 6, 9, 11, 12],
]);
assert.deepEqual(ids(25, 6, 3), [
  [22, 23, 24],
  [18, 19, 20, 21],
  [2, 5, 8, 11, 14, 17],
  [1, 4, 7, 10, 13, 16],
  [0, 3, 6, 9, 12, 15],
]);
assert.deepEqual(ids(12, 6, 2), [
  [1, 3, 5, 7, 9, 11],
  [0, 2, 4, 6, 8, 10],
]);
assert.deepEqual(
  seed(entries(6), 6)[0].lanes.map((l) => l.lane),
  [3, 4, 2, 5, 1, 6],
);
assert.deepEqual(
  seed(entries(8), 8)[0].lanes.map((l) => l.lane),
  [4, 5, 3, 6, 2, 7, 1, 8],
);
const tied = seed(
  [
    { id: "nt1", entryOrder: 3 },
    { id: "b", seedCs: 2000, entryOrder: 2 },
    { id: "a", seedCs: 2000, entryOrder: 1 },
    { id: "nt0", entryOrder: 0 },
  ],
  6,
);
assert.deepEqual(
  tied[0].lanes.map((l) => l.entry.id),
  ["a", "b", "nt0", "nt1"],
);
let rng = 75;
for (let i = 0; i < 1000; i++) {
  rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
  const n = Math.floor((rng / 4294967296) * 300);
  const lanes = ([4, 6, 8, 10] as const)[i % 4];
  const hs = seed(entries(n), lanes, ([0, 2, 3] as const)[i % 3]);
  assert.equal(hs.flatMap((h) => h.lanes).length, n);
  assert.equal(
    new Set(hs.flatMap((h) => h.lanes.map((l) => l.entry.id))).size,
    n,
  );
  for (const h of hs) {
    assert.ok(h.lanes.length <= lanes);
    assert.equal(new Set(h.lanes.map((l) => l.lane)).size, h.lanes.length);
    assert.ok(h.lanes.every((l) => LANE_ORDER[lanes].includes(l.lane)));
  }
}
console.log(
  "G9 PASS: 10 hand fixtures including partial-circle/2-circle/ties/NT/6+8 lanes; 1000 randomized size properties",
);

const event = seed([{ id: "a", seedCs: 6000, entryOrder: 0 }], 6);
const timing = { gapBetweenHeatsS: 10, gapBetweenEventsS: 20 };
const booking = { start: "18:00", end: "18:02" };
const estimate = timeline([event], booking, timing);
assert.equal(estimate.expectedS, 90);
assert.equal(estimate.pessimisticS, 93);
assert.ok(
  timeline([event, event], booking, timing).expectedS >= estimate.expectedS,
);
for (const [cs, over] of [
  [8900, false],
  [9000, false],
  [9100, true],
] as const) {
  const result = timeline(
    [seed([{ id: "a", seedCs: cs, entryOrder: 0 }], 6)],
    booking,
    timing,
  );
  assert.equal(result.overrun, over);
  assert.equal(result.overrunS, cs / 100 - 90);
}
assert.throws(() =>
  timeline([seed([{ id: "nt", entryOrder: 0 }], 6)], booking, timing),
);
assert.equal(
  timeline([seed([{ id: "nt", entryOrder: 0 }], 6)], booking, {
    ...timing,
    ntEstimateS: 60,
  }).expectedS,
  90,
);
console.log(
  "G10 PASS: expected 90 s / pessimistic 93 s; event monotonicity; -1/0/+1 s overrun boundaries; explicit NT estimate required",
);
