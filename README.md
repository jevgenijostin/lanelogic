# LaneLogic

Browser-only relay assignment engine. Explicit eligibility inputs; validates the model, not federation regulations. Practice seeding — not federation-compliant.

## Development

Requires Node 24 (tested with 24.17.0).

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run preview
# In another terminal, with the preview running on port 4173:
npm run test:browser
```

`npm run dev` starts the development harness. The production harness has a Worker smoke test and a joint-vs-sequential demo with an independently validated result and exact savings banner. It is not the finished club UI.

The pinned `highs@1.15.4` runtime is imported through `highs/runtime?url`; Vite emits its WASM as a local asset. The solver initializes inside `src/worker.ts`. No CDN or remote solver is used. See [HiGHS loading documentation](https://lovasoa.github.io/highs-js/docs/functions/default.html).

## Engine and verification

- `src/domain.ts`: integer-centisecond types, input guards and whole-year age calculation. Team slots and legs are zero-based.
- `src/model.ts`: C1–C8 LP generation. Three lexicographic solves maximize weighted coverage, minimize raw time, then minimize a fixed hash-mod-10 objective.
- `src/solver.ts`: HiGHS orchestration, zero MIP gaps, incumbent validation, status handling and individual-family relaxation diagnostics.
- `src/validator.ts`: independent checks, with no imports from the model builder or shared eligibility helpers.
- `tests/oracle.ts`: independent exhaustive ordered four-swimmer enumeration. It retains the cheapest ordering per member set and memoizes remaining subproblems; it uses no MILP builder, validator, or lower-bound pruning. Test-only, intended for the 6–10-swimmer gate instances.
- `src/sequential.ts`: priority-descending sequential baseline. Accepted teams consume capacity for later relays. It never claims whole-meet optimality. Seconds saved are only compared when both results field the same team slots.
- `src/parsing.ts`, `src/seeding.ts`, `src/timeline.ts`: strict times/CSV, practice seeding and session estimates.

Run results and decisions: [round-one report](reports/engine-round1.txt), [raw Node output](reports/gates-node.txt), [raw browser output](reports/gates-browser.txt), [production build output](reports/build.txt).

CSV requires `id,name,sex,dob,individualEntries`, followed by time columns such as `free50,back50,breast50,fly50`. Quoted names are accepted. Use `NT` for absent times. Any bad row rejects the entire import with physical row numbers.

## Interpretation and limits

- C4 is literal: an individual-entry count above the cap makes the input infeasible, even if that swimmer receives no relay assignment. At the cap, the swimmer has zero available relay entries.
- Without pins and with valid nonnegative remaining caps, skipping all teams is feasible. Lack of eligible swimmers normally means unfielded teams, not infeasibility.
- A is relabelled fastest only for events with no pins or bans. Locked event slot identities are preserved. `stats.tie` records the solved hash objective before display relabelling; `stats.costCs` is always raw time. Reported team totals subtract the split adjustment three times.
- Hash-mod-10 does not uniquely order every optimum. Fixed seed, one solver thread and the pinned runtime passed repeatability tests in Node and Chromium, including Worker restarts; cross-version/cross-browser identity is not claimed. Timing measurements are deliberately outside solution JSON.
- Time limits cover the three primary solves together (solver time, not all JS overhead). Node limits apply to each stage. Diagnostic re-solves get separate budgets. A limited solve returns a validated incumbent as `feasible`, or `no_solution_found`; no optimality claim is made after a solver limit.
- Diagnostics relax one family at a time, not a minimum conflict set. “eligibility” relaxes sex/mixed balance and missing times; “age bands” relaxes individual and summed ages. Synthetic times used in diagnostic re-solves never appear in returned lineups. Multiple simultaneous causes may not be resolved by any single relaxation.
- HiGHS passed the representative 40-swimmer, six-relay, 12-team fixture. This is a measured case, not a promised maximum or universal performance guarantee. The fallback engine was not needed and is not shipped.
- Practice seeding supports both 2- and 3-heat circle groups and custom valid lane-order permutations. NT entries sort last. Timeline calculation requires an explicit NT estimate; it never treats NT as zero. Booking windows must end later on the same day. Expected and pessimistic estimates use factors 1.0 and 1.05.

## Scope

Engine-first MVP; six-screen UI and gates G11–G14 follow in round two. Roster editing, persistence, JSON import/export, tier gating, heat-sheet/print rendering and branding are not implemented yet. Tier flag will be a demo, not license enforcement. The suggested €50–80 annual club price remains unvalidated.

## Cuts and follow-ups

1. Meet Manager / HY3 / CL2 interoperability (largest buyer-facing gap).
2. No meet-points objective, federation compliance, coupled scheduling, fatigue spacing, or individual-event optimization.
3. Print stylesheet later; no PDF library, license cryptography, season history, backend/accounts, or i18n.
4. Product queue: DeckSim, then Snarewire (local HTTP/SQLite/webhooks; document beacons and public hosting later). FormPeak optimizer dropped.
