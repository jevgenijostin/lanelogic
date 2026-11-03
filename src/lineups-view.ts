import { type AppState, validationInput } from "./state";
import { strokes } from "./domain";
import { formatTime } from "./parsing";
import { validate } from "./validator";
import { canUse } from "./features";
import { escape, button, badge, options } from "./ui";
export function lineups(state: AppState, busy: boolean, elapsed: number) {
  const result = state.solution;
  const errors = result?.teams.length
    ? validate(validationInput(state), result.teams)
    : [];
  const comparison = state.comparison;
  return `<div class="action-bar"><div><h2>Your fastest valid combination.</h2><p class="hint">Free solves keep earlier relays fixed. Pro allocates the whole meet jointly.</p></div><div class="toolbar">${button("Clear accepted lineups", "clear-results", "", busy || !result)}${button("Solve whole meet · Pro", "solve-all", "primary", busy || !canUse("wholeMeet", state.tier))}</div></div>
  ${canUse("savings", state.tier) && comparison ? `<aside class="savings" id="savings"><span class="eyebrow">JOINT VS SEQUENTIAL</span><strong>${comparison.savedCs === null ? `${comparison.additionalTeams > 0 ? "+" : ""}${comparison.additionalTeams} teams fielded` : `${(comparison.savedCs / 100).toFixed(2)} s saved`}</strong><span>${comparison.savedCs === null ? `Coverage differs; seconds are not comparable. Weighted coverage difference: ${comparison.additionalWeight}.` : "Same team slots and coverage. Raw split totals compared."}</span></aside>` : ""}
  <div class="result-status">${badge(busy ? "Solving" : (result?.status.replaceAll("_", " ") ?? "Not solved"), result?.status === "optimal" ? "teal" : "")}<span>${result ? `${result.teams.length} / ${state.input.relays.reduce((n, r) => n + r.teams, 0)} teams fielded` : "Choose a relay to start"}${elapsed ? ` · ${Math.round(elapsed)} ms` : ""}</span></div>
  ${result?.diagnostics.length ? `<aside class="notice">${result.diagnostics.map((d) => escape(d)).join("<br>")}</aside>` : ""}
  ${state.input.relays
    .map(
      (r, ri) =>
        `<section class="event-section"><div class="section-heading"><div><span class="eyebrow">EVENT ${String(ri + 1).padStart(2, "0")} · PRIORITY ${r.priority}</span><h2>${escape(r.name)}</h2><p class="hint">${r.gender === "X" ? "2 female + 2 male" : r.gender === "F" ? "Female" : "Male"} · 4 × ${r.legDist} m · ${r.kind} · ${state.solvedRelays.includes(r.id) ? "Accepted" : "Awaiting solve"}</p></div>${button("Solve this relay", `solve:${ri}`, "", busy)}</div><div class="team-grid">${Array.from(
          { length: r.teams },
          (_, slot) => {
            const team = result?.teams.find(
              (t) => t.team.relayId === r.id && t.team.slot === slot,
            );
            return `<article class="team-card"><div class="team-heading"><h3>Team ${String.fromCharCode(65 + slot)}</h3>${badge(team ? "Fielded" : state.solvedRelays.includes(r.id) ? "Unfielded" : "Unsolved", team ? "teal" : "")}<strong>${team ? formatTime(team.totalCs) : "—"}</strong></div><ol class="legs">${strokes(
              r,
            )
              .map((stroke, leg) => {
                const split = team?.legs.find((l) => l.leg === leg);
                const swimmer = state.input.swimmers.find(
                  (s) => s.id === split?.swimmerId,
                );
                return `<li><span class="leg-number">${leg + 1}</span><div><strong>${escape(swimmer?.name ?? "Open leg")}</strong><small>${stroke} · ${r.legDist} m</small></div><span class="split">${split ? formatTime(split.cs) : "NT"}</span>${split ? `<button class="pin-button" data-pin="${ri},${slot},${leg}" title="Pin this swimmer to this leg" aria-label="Pin ${escape(swimmer?.name)} to ${escape(r.name)} team ${String.fromCharCode(65 + slot)} leg ${leg + 1}" ${busy ? "disabled" : ""}>Pin</button>` : ""}</li>`;
              })
              .join(
                "",
              )}</ol><div class="checks"><strong>Independent checks</strong>${team ? `<ul>${errors.length ? errors.map((e) => `<li class="danger">${escape(e)}</li>`).join("") : ["✓ Four distinct swimmers · C1–C2", "✓ Event uniqueness & entry caps · C3–C4", "✓ Team order, sex & age bounds · C5–C7", "✓ Pins, bans & reported splits · C8"].map((t) => `<li>${t}</li>`).join("")}</ul>` : "<p>Checks run when a lineup is returned.</p>"}</div><p class="card-foot">${team ? `Raw splits shown · team total includes −${((3 * state.input.meet.startSplitAdjustCs) / 100).toFixed(2)} s start adjustment` : "Eligibility, times, caps and pins determine available places."}</p></article>`;
          },
        ).join("")}</div></section>`,
    )
    .join("")}
  <section class="panel"><h2>Pins & bans ${badge(state.input.locks.length.toString())}</h2><p class="hint">Pin forces a swimmer into one leg; ban excludes them from that leg. Changes clear accepted lineups. Pins preserve A/B/C identities.</p><form id="lock-form" class="lock-form"><label>Swimmer<select name="swimmer">${state.input.swimmers.map((s) => `<option value="${escape(s.id)}">${escape(s.name)}</option>`).join("")}</select></label><label>Team<select name="team">${state.input.relays.flatMap((r, i) => Array.from({ length: r.teams }, (_, s) => `<option value="${i},${s}">${escape(r.name)} / ${String.fromCharCode(65 + s)}</option>`)).join("")}</select></label><label>Leg<select name="leg">${options([1, 2, 3, 4], 1)}</select></label><label>Mode<select name="mode">${options(["pin", "ban"], "pin")}</select></label><button class="primary" ${busy || !state.input.swimmers.length || !state.input.relays.length ? "disabled" : ""}>Add constraint</button></form><div class="lock-list">${state.input.locks.map((l, i) => `<div>${badge(l.mode)} ${escape(state.input.swimmers.find((s) => s.id === l.swimmerId)?.name)} → ${escape(state.input.relays.find((r) => r.id === l.team.relayId)?.name)} / ${String.fromCharCode(65 + l.team.slot)} / leg ${l.leg + 1}<button data-remove-lock="${i}" aria-label="Remove constraint ${i + 1}" ${busy ? "disabled" : ""}>Remove</button></div>`).join("")}</div></section>`;
}
