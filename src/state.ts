import { assertInput, type Input, type Solution } from "./domain";
import { seed } from "./seeding";
import { timeline } from "./timeline";
import { validate } from "./validator";
import type { Tier } from "./features";
import { sampleMeet } from "./sample";
export const STORAGE_KEY = "lanelogic.v1";
export interface AppState {
  version: 1;
  tier: Tier;
  brand: string;
  input: Input;
  solvedRelays: string[];
  solution: Solution | null;
  comparison: {
    savedCs: number | null;
    additionalTeams: number;
    additionalWeight: number;
  } | null;
}
export function initialState(): AppState {
  return {
    version: 1,
    tier: "free",
    brand: "Northside Swim Club",
    input: sampleMeet(),
    solvedRelays: [],
    solution: null,
    comparison: null,
  };
}
export function checkInput(p: Input) {
  assertInput(p);
  if (!p.meet.name.trim() || p.swimmers.some((s) => !s.name.trim()))
    throw Error("Names cannot be empty");
  if (
    ![4, 6, 8, 10].includes(p.meet.lanes) ||
    ![0, 2, 3].includes(p.meet.circleHeats)
  )
    throw Error("Invalid lane or circle setting");
  seed([], p.meet.lanes, p.meet.circleHeats, p.meet.laneOrder);
  timeline([], p.meet.poolBooking, p.meet.timing);
  if (p.meet.timing.pessimism !== 1.05 || p.meet.minSlowestHeat !== 3)
    throw Error(
      "Practice rules require pessimism 1.05 and minimum slowest heat 3",
    );
  if (
    p.meet.startSplitAdjustCs < 0 ||
    p.swimmers.some((s) =>
      Object.values(s.times).some((cs) => cs <= p.meet.startSplitAdjustCs),
    )
  )
    throw Error(
      "Split adjustment must be nonnegative and smaller than every recorded split",
    );
  for (const r of p.relays) {
    if (
      !r.name.trim() ||
      (r.ageMin ?? 0) > (r.ageMax ?? Infinity) ||
      (r.ageSumMin ?? 0) > (r.ageSumMax ?? Infinity)
    )
      throw Error("Invalid relay name or age range");
  }
  for (const l of p.locks) {
    const r = p.relays.find((r) => r.id === l.team.relayId);
    if (
      !r ||
      !p.swimmers.some((s) => s.id === l.swimmerId) ||
      !["pin", "ban"].includes(l.mode) ||
      ![0, 1, 2, 3].includes(l.leg) ||
      !Number.isInteger(l.team.slot) ||
      l.team.slot < 0 ||
      l.team.slot >= r.teams
    )
      throw Error("Invalid pin or ban");
  }
}
export function validationInput(state: AppState): Input {
  return {
    ...state.input,
    locks: state.input.locks.filter((l) =>
      state.solvedRelays.includes(l.team.relayId),
    ),
  };
}
export function checkState(s: AppState) {
  if (
    s.version !== 1 ||
    !["free", "pro"].includes(s.tier) ||
    typeof s.brand !== "string" ||
    !Array.isArray(s.solvedRelays)
  )
    throw Error("Unsupported LaneLogic backup");
  checkInput(s.input);
  if (
    new Set(s.solvedRelays).size !== s.solvedRelays.length ||
    s.solvedRelays.some((id) => !s.input.relays.some((r) => r.id === id))
  )
    throw Error("Invalid solved relays");
  if (s.solution) {
    if (
      !["optimal", "feasible", "infeasible", "no_solution_found"].includes(
        s.solution.status,
      ) ||
      !Array.isArray(s.solution.diagnostics) ||
      !s.solution.diagnostics.every((d) => typeof d === "string") ||
      !Object.values(s.solution.stats).every(Number.isFinite)
    )
      throw Error("Invalid solution");
    if (s.solution.teams.some((t) => !s.solvedRelays.includes(t.team.relayId)))
      throw Error("Unexpected solved team");
    const errors = validate(validationInput(s), s.solution.teams);
    if (s.solution.teams.length && errors.length)
      throw Error(`Invalid saved lineup: ${errors.join(", ")}`);
  }
  if (
    s.comparison &&
    (![s.comparison.additionalTeams, s.comparison.additionalWeight].every(
      Number.isFinite,
    ) ||
      (s.comparison.savedCs !== null && !Number.isFinite(s.comparison.savedCs)))
  )
    throw Error("Invalid comparison");
}
export function exportJSON(s: AppState) {
  checkState(s);
  return JSON.stringify(s, null, 2);
}
export function importJSON(text: string): AppState {
  try {
    const s = JSON.parse(text);
    checkState(s);
    return s;
  } catch (e) {
    throw Error(`Backup not imported: ${(e as Error).message}`);
  }
}
export function clearResults(s: AppState) {
  s.solution = null;
  s.comparison = null;
  s.solvedRelays = [];
}
