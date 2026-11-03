import type { Highs } from "highs";
import { hash, key, type Input, type Solution } from "./domain";
import { solve, type Limits } from "./solver";
import { validate } from "./validator";
export function sequential(
  p: Input,
  highs: Highs,
  limits: Limits = {},
): Solution {
  const q = structuredClone(p);
  const teams: Solution["teams"] = [];
  const diagnostics: string[] = [];
  let proven = true;
  for (const r of [...p.relays].sort(
    (a, b) =>
      b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )) {
    const input = {
      ...q,
      relays: [r],
      locks: q.locks.filter((l) => l.team.relayId === r.id),
    };
    const result = solve(input, highs, limits);
    if (result.status === "infeasible") {
      return {
        status: "infeasible",
        teams: [],
        stats: { weight: 0, costCs: 0, tie: 0 },
        diagnostics: [`Sequential conflict: ${r.id}`, ...result.diagnostics],
      };
    }
    if (result.status !== "optimal") proven = false;
    teams.push(...result.teams);
    if (result.teams.length < r.teams)
      diagnostics.push(`Unfielded: ${r.id} (${r.teams - result.teams.length})`);
    for (const team of result.teams)
      for (const leg of team.legs)
        q.swimmers.find((s) => s.id === leg.swimmerId)!.individualEntries++;
  }
  const errors = validate(p, teams);
  if (errors.length)
    return {
      status: "no_solution_found",
      teams: [],
      stats: { weight: 0, costCs: 0, tie: 0 },
      diagnostics: errors,
    };
  return {
    status: "feasible",
    teams,
    stats: {
      weight: teams.reduce(
        (a, t) => a + p.relays.find((r) => r.id === t.team.relayId)!.priority,
        0,
      ),
      costCs: teams.reduce(
        (a, t) => a + t.legs.reduce((b, l) => b + l.cs, 0),
        0,
      ),
      tie: teams.reduce(
        (a, t) =>
          a +
          t.legs.reduce(
            (b, l) => b + hash(`${l.swimmerId}/${key(t.team)}/${l.leg}`),
            0,
          ),
        0,
      ),
    },
    diagnostics: [
      ...diagnostics,
      proven
        ? "Each relay optimal in sequence; whole-meet optimality not claimed"
        : "Sequential solve reached a resource limit",
    ],
  };
}
export function compare(joint: Solution, baseline: Solution) {
  const comparable =
    joint.stats.weight === baseline.stats.weight &&
    joint.teams.length === baseline.teams.length &&
    JSON.stringify(joint.teams.map((t) => key(t.team)).sort()) ===
      JSON.stringify(baseline.teams.map((t) => key(t.team)).sort()) &&
    !["infeasible", "no_solution_found"].includes(baseline.status) &&
    !["infeasible", "no_solution_found"].includes(joint.status);
  return {
    savedCs: comparable ? baseline.stats.costCs - joint.stats.costCs : null,
    additionalTeams: joint.teams.length - baseline.teams.length,
    additionalWeight: joint.stats.weight - baseline.stats.weight,
  };
}
