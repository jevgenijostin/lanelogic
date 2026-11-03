# LaneLogic

Browser-only swim-meet relay planner with six screens: roster, meet setup, relay lineups, heat sheets, timeline, and rules. Explicit eligibility inputs; validates the model, not federation regulations. Practice seeding - not federation-compliant.

## Development

Requires Node 24 (tested with 24.17.0).

```sh
npm ci
npx playwright install chromium
npm test
npm run test:ui
npm run verify:browser
```

`npm run dev` starts the UI. `npm run verify:browser` builds the production app, starts a hidden preview child on an available local port, runs the engine and UI Playwright suites, writes their raw reports, and stops preview in a `finally` block. Startup and test deadlines prevent an indefinitely blocking server. Chromium must be installed first.

For manual use, run `npm run build`, then `npm run preview` in a separate terminal and open http://127.0.0.1:4173. Preview is a long-running server: do not run it as a blocking automation step expecting it to exit. `test:browser` and `test:ui:browser` can target an already running preview (default port 4173; override with `PREVIEW_URL`). The preserved `/engine.html` is a diagnostic lab for G0/G6/G7, separate from the tier-gated club UI.

## Using the workspace

1. The first visit opens a 40-swimmer practice sample. Edit roster cells or replace the roster with CSV. Times accept `28.45`, `1:02.34`, or `NT`; Tab moves between cells. The expandable CSV panel includes a downloadable template, sample reset and empty-workspace action.
2. Set relay definitions, team counts, priorities, age bounds, entry caps, lane order, booking window and heat/event gaps in Meet setup. Pessimism is fixed at 1.05 to match the verified engine.
3. Solve each relay in Free, in your chosen order. Accepted earlier teams consume swimmer capacity and remain unchanged. Use Clear accepted lineups to start again. Pro's whole-meet solve replaces the sequence with a joint allocation and computes a priority-ordered sequential comparison in the Worker.
4. Pin a returned leg or add a pin/ban using the constraint form. Editing inputs or constraints clears old results. Cards show raw leg splits, adjusted team totals, solver status and the independent checks. Infeasible results show diagnostic constraint families; cancellation keeps previously accepted results.
5. In Pro, open Heat sheets for lane assignments and a print preview. Branded print uses the club name from setup and a print stylesheet; the browser can save this as PDF. Timeline estimates fielded relay heats against the pool booking and marks overruns.
6. Export JSON to retain a portable backup. Validated imports replace the workspace atomically. Roster, setup, constraints, tier flag, branding and accepted results persist in localStorage. Storage failures leave the edit in memory and visibly request a backup. No accounts, CDN, analytics, remote fonts or server-side solve.

## Tier preview

| Feature | Free | Pro |
|---|---|---|
| Roster, setup, one-relay solve, basic lineups | Yes | Yes |
| Joint whole-meet solve and savings comparison | No | Yes |
| Heat sheets, circle seeding, timeline | No | Yes |
| Club-branded print | No | Yes |

The tier selector is **a demo feature flag, not real license enforcement**. There is no payment collection or cryptographic license check. `canUse` and action-level guards are unit-tested; Free requests cannot call the club UI's whole-meet Worker action, heat-sheet generator, timeline or print callback. This is product gating, not a security boundary against modifying browser code or using the diagnostic lab. The suggested €50–80 annual club price remains unvalidated.

The pinned `highs@1.15.4` runtime is imported through `highs/runtime?url`; Vite emits its WASM as a local asset. The solver initializes inside `src/worker.ts`. No CDN or remote solver is used. See [HiGHS loading documentation](https://lovasoa.github.io/highs-js/docs/functions/default.html).

## Engine and verification

- `src/domain.ts`: integer-centisecond types, input guards and whole-year age calculation. Team slots and legs are zero-based.
- `src/model.ts`: C1–C8 LP generation. Three lexicographic solves maximize weighted coverage, minimize raw time, then minimize a fixed hash-mod-10 objective.
- `src/solver.ts`: HiGHS orchestration, zero MIP gaps, incumbent validation, status handling and individual-family relaxation diagnostics.
- `src/validator.ts`: independent checks, with no imports from the model builder or shared eligibility helpers.
- `tests/oracle.ts`: independent exhaustive ordered four-swimmer enumeration. It retains the cheapest ordering per member set and memoizes remaining subproblems; it uses no MILP builder, validator, or lower-bound pruning. Test-only, intended for the 6–10-swimmer gate instances.
- `src/sequential.ts`: priority-descending sequential baseline. Accepted teams consume capacity for later relays. It never claims whole-meet optimality. Seconds saved are only compared when both results field the same team slots.
- `src/parsing.ts`, `src/seeding.ts`, `src/timeline.ts`: strict times/CSV, practice seeding and session estimates.

Run results and decisions: [UI round report, including all G0–G14 raw output](reports/ui-round2.txt), [round-one report](reports/engine-round1.txt), [engine Node output](reports/gates-node.txt), [engine browser output](reports/gates-browser.txt), [UI unit output](reports/gates-ui-unit.txt), [UI browser output](reports/gates-ui-browser.txt), [production build output](reports/build.txt). [Screenshots](reports/screenshots) cover all six screens, mobile and overrun states; [printed heat-sheet sample](reports/heat-sheets.pdf) exercises the print stylesheet.

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
- Heat sheets are generated from this club's solved relay teams. With the specified maximum of three teams per event and at least four lanes, current UI events fit into one heat; circle settings are supported but cannot change those single-heat sheets. Multi-heat and circle logic is independently exercised by G9. Opponent entries and individual-event heat sheets are outside this round.
- The UI applies an 8-second engine budget and a 30-second total Worker deadline, including sequential comparison and diagnostic solves. The representative meet gate measures the actual whole UI action, including the comparison, not just one internal solve. Larger or difficult inputs can time out.
- Changing input data clears all accepted results. Imported solutions are revalidated, including objective totals, but an imported `optimal` label is not a mathematical certificate. Do not treat untrusted backup files as proof of optimality.
- The UI rejects negative flying-start adjustments and adjustments greater than or equal to a recorded split so reported times remain positive. This is an input guard around the frozen engine. Persistent state is browser/origin-specific; live merging across tabs is not implemented.

## Scope

All six UI screens and G11–G14 are implemented on top of the existing engine. CourtKit's compact tables, bordered cards, clear action bars, local backups, responsive layout and dedicated print treatment are the component precedent. Desktop (1440px) and mobile (390px) layouts are exercised in Playwright. Engine sources are unchanged from the verified `3f6dbf0` baseline.

## Cuts and follow-ups

1. Meet Manager / HY3 / CL2 interoperability (largest buyer-facing gap).
2. No meet-points objective, federation compliance, coupled scheduling, fatigue spacing, or individual-event optimization.
3. Print stylesheet shipped; no PDF library, license cryptography, season history, backend/accounts, or i18n.
4. Product queue: DeckSim, then Snarewire (local HTTP/SQLite/webhooks; document beacons and public hosting later). FormPeak optimizer dropped.

