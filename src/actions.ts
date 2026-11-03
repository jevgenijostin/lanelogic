import type { Input, Solution } from "./domain";
import { requireFeature, type Tier } from "./features";
import { checkState, validationInput, type AppState } from "./state";
import { validate } from "./validator";
import { seed } from "./seeding";
import { timeline } from "./timeline";
export interface WorkerResult {
  solution?: Solution;
  joint?: Solution;
  comparison?: AppState["comparison"];
  error?: string;
}
export type Request = (input: Input, compare: boolean) => Promise<WorkerResult>;
export async function solveAction(
  state: AppState,
  request: Request,
  relayId?: string,
): Promise<AppState> {
  requireFeature(relayId ? "relay" : "wholeMeet", state.tier);
  checkState(state);
  const next = structuredClone(state);
  const input = structuredClone(state.input);
  if (relayId) {
    const relay = input.relays.find((r) => r.id === relayId);
    if (!relay) throw Error("Unknown relay");
    input.relays = [relay];
    input.locks = input.locks.filter((l) => l.team.relayId === relayId);
    for (const team of state.solution?.teams ?? [])
      if (team.team.relayId !== relayId)
        for (const leg of team.legs)
          input.swimmers.find((s) => s.id === leg.swimmerId)!
            .individualEntries++;
  }
  const result = await request(input, !relayId);
  if (result.error) throw Error(result.error);
  const solution = relayId ? result.solution : result.joint;
  if (!solution) throw Error("Worker returned no solution");
  if (relayId) {
    if (["infeasible", "no_solution_found"].includes(solution.status))
      throw Error(
        `${solution.status}: ${solution.diagnostics.join(", ") || "No valid lineup returned"}. Earlier accepted relays were kept.`,
      );
    next.solution = {
      ...solution,
      status: "feasible",
      teams: [
        ...(state.solution?.teams ?? []).filter(
          (t) => t.team.relayId !== relayId,
        ),
        ...solution.teams,
      ],
      diagnostics: [
        "Sequential allocation; earlier accepted relays kept. Whole-meet optimality not claimed.",
        ...solution.diagnostics,
      ],
    };
    next.solvedRelays = [...new Set([...state.solvedRelays, relayId])];
    next.solution.stats = {
      weight: next.solution.teams.reduce(
        (n, t) =>
          n + state.input.relays.find((r) => r.id === t.team.relayId)!.priority,
        0,
      ),
      costCs: next.solution.teams.reduce(
        (n, t) => n + t.legs.reduce((a, l) => a + l.cs, 0),
        0,
      ),
      tie: 0,
    };
    next.comparison = null;
  } else {
    next.solution = solution;
    next.solvedRelays = state.input.relays.map((r) => r.id);
    next.comparison = result.comparison ?? null;
  }
  if (next.solution.teams.length) {
    const errors = validate(validationInput(next), next.solution.teams);
    if (errors.length)
      throw Error(`Independent validation failed: ${errors.join(", ")}`);
  }
  checkState(next);
  return next;
}
export function heatSheets(state: AppState) {
  requireFeature("heatSheets", state.tier);
  return state.input.relays.map((r) => ({
    relay: r,
    heats: seed(
      (state.solution?.teams ?? [])
        .filter((t) => t.team.relayId === r.id)
        .map((t) => ({
          id: `${r.id}:${t.team.slot}`,
          seedCs: t.totalCs,
          entryOrder: t.team.slot,
        })),
      state.input.meet.lanes,
      state.input.meet.circleHeats,
      state.input.meet.laneOrder,
    ),
  }));
}
export function sessionTimeline(state: AppState) {
  requireFeature("timeline", state.tier);
  return timeline(
    heatSheets(state)
      .filter((e) => e.heats.length)
      .map((e) => e.heats),
    state.input.meet.poolBooking,
    state.input.meet.timing,
  );
}
export function brandedPrint(tier: Tier, print: () => void) {
  requireFeature("brandedPrint", tier);
  print();
}
