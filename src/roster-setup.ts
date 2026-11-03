import type { AppState } from "./state";
import { strokes } from "./domain";
import { formatTime } from "./parsing";
import { canUse } from "./features";
import {
  escape,
  button,
  badge,
  disclaimer,
  empty,
  options,
  field,
  selectField,
} from "./ui";
export function roster(state: AppState, busy: boolean) {
  const p = state.input;
  const keys = [
    ...new Set([
      "free50",
      "back50",
      "breast50",
      "fly50",
      ...p.relays.flatMap((r) => strokes(r).map((s) => `${s}${r.legDist}`)),
      ...p.swimmers.flatMap((s) => Object.keys(s.times)),
    ]),
  ];
  const missing = p.swimmers.filter((s) =>
    keys.some((k) => s.times[k] === undefined),
  ).length;
  return `<div class="metrics"><article><span>SWIMMERS</span><strong>${p.swimmers.length}</strong><small>${p.swimmers.filter((s) => s.sex === "F").length} female · ${p.swimmers.filter((s) => s.sex === "M").length} male</small></article><article><span>RELAY PLACES</span><strong>${p.relays.reduce((n, r) => n + r.teams * 4, 0)}</strong><small>Across ${p.relays.length} events</small></article><article><span>WITH MISSING TIMES</span><strong>${missing.toString().padStart(2, "0")}</strong><small>NT excludes that stroke / distance</small></article><article class="metric-accent"><span>YOUR DATA</span><strong>On deck.</strong><small>Local storage · no accounts</small></article></div>
  <section class="panel"><div class="section-heading"><div><h2>Club roster ${badge(`${p.swimmers.length} swimmers`)}</h2><p class="hint">Edit any cell. Times use 28.45, 1:02.34, or NT. Changes clear previous results.</p></div><div class="toolbar">${button("+ Add swimmer", "add-swimmer", "", busy)}${button("Import CSV", "csv", "primary", busy)}<input id="csv-file" type="file" accept=".csv,text/csv" hidden></div></div>
  <div class="table-scroll"><table class="roster-table"><thead><tr><th>#</th><th>Swimmer</th><th>Sex</th><th>Date of birth</th><th>Individual<br>entries</th>${keys.map((k) => `<th>${escape(k.replace(/(\d+)/, " $1"))}</th>`).join("")}<th><span class="sr-only">Remove</span></th></tr></thead><tbody>${p.swimmers.map((s, i) => `<tr><td class="row-index">${String(i + 1).padStart(2, "0")}</td><td><input aria-label="Swimmer ${i + 1} name" data-swimmer="${i}" data-field="name" value="${escape(s.name)}"></td><td><select aria-label="${escape(s.name)} sex" data-swimmer="${i}" data-field="sex">${options(["M", "F"], s.sex)}</select></td><td><input type="date" aria-label="${escape(s.name)} date of birth" data-swimmer="${i}" data-field="dob" value="${s.dob}"></td><td><input type="number" min="0" step="1" aria-label="${escape(s.name)} individual entries" data-swimmer="${i}" data-field="individualEntries" value="${s.individualEntries}"></td>${keys.map((k) => `<td><input class="time-cell ${s.times[k] === undefined ? "nt" : ""}" aria-label="${escape(s.name)} ${escape(k)}" data-swimmer="${i}" data-time="${escape(k)}" value="${formatTime(s.times[k])}"></td>`).join("")}<td><button class="icon-button danger" aria-label="Remove ${escape(s.name)}" data-remove-swimmer="${i}" ${busy ? "disabled" : ""}>×</button></td></tr>`).join("")}</tbody></table></div>${!p.swimmers.length ? empty("Your team starts here.", "Add a swimmer or import a CSV roster.") : ""}<div class="table-bottom"><span>Times stored in exact hundredths of a second</span><span>Auto-save on edit</span></div></section>
  <details class="panel compact"><summary>CSV format & sample data</summary><p class="hint">Required header: <code>id,name,sex,dob,individualEntries,free50,back50,breast50,fly50</code>. Use M/F, YYYY-MM-DD, and NT for missing times. A bad row rejects the entire import. Import replaces the roster and clears pins and results.</p><div class="toolbar">${button("Download CSV template", "csv-template")}${button("Load 40-swimmer sample", "sample", "", busy)}${button("Start empty meet", "empty", "", busy)}</div><p class="hint">Loading a sample or starting empty replaces this workspace. Export a backup first.</p></details>`;
}
function relayField(
  label: string,
  i: number,
  key: string,
  value: unknown,
  type = "text",
) {
  return `<label>${label}<input aria-label="Relay ${i + 1} ${label}" data-relay="${i}" data-field="${key}" type="${type}" ${type === "number" ? 'min="0" step="1"' : ""} value="${escape(value)}"></label>`;
}
function relaySelect(
  label: string,
  i: number,
  key: string,
  value: unknown,
  values: (string | number)[],
) {
  return `<label>${label}<select aria-label="Relay ${i + 1} ${label}" data-relay="${i}" data-field="${key}">${options(values, value)}</select></label>`;
}
export function setup(state: AppState, busy: boolean) {
  const m = state.input.meet;
  return `<section class="panel"><div class="section-heading"><div><h2>Meet essentials</h2><p class="hint">Eligibility is evaluated on the age-up date. The cap includes individual entries.</p></div>${badge("Explicit inputs", "teal")}</div><div class="form-grid">${field("Meet name", "name", m.name)}${field("Age-up date", "ageUpDate", m.ageUpDate, "date")}${field("Total entry cap / swimmer", "relayLimitPerSwimmer", m.relayLimitPerSwimmer, "number", 'min="0" step="1"')}${field("Flying-start adjustment (cs)", "startSplitAdjustCs", m.startSplitAdjustCs, "number", 'min="0" step="1"')}</div></section>
  <section class="panel"><div class="section-heading"><div><h2>Relay definitions</h2><p class="hint">Higher priority is fielded first. Blank age bounds mean unrestricted.</p></div>${button("+ Add relay", "add-relay", "", busy)}</div><div class="relay-edit-list">${state.input.relays.map((r, i) => `<article class="relay-edit"><div class="relay-number">${String(i + 1).padStart(2, "0")}</div><div class="relay-fields">${relayField("Event name", i, "name", r.name)}${relaySelect("Kind", i, "kind", r.kind, ["free", "medley"])}${relaySelect("Gender", i, "gender", r.gender, ["M", "F", "X"])}${relayField("Leg distance (m)", i, "legDist", r.legDist, "number")}${relaySelect("Teams", i, "teams", r.teams, [1, 2, 3])}${relayField("Priority (1–9)", i, "priority", r.priority, "number")}${relayField("Min age", i, "ageMin", r.ageMin, "number")}${relayField("Max age", i, "ageMax", r.ageMax, "number")}${relayField("Min age sum", i, "ageSumMin", r.ageSumMin, "number")}${relayField("Max age sum", i, "ageSumMax", r.ageSumMax, "number")}</div><button class="icon-button danger" data-remove-relay="${i}" aria-label="Remove relay ${i + 1}" ${busy ? "disabled" : ""}>×</button></article>`).join("")}</div></section>
  <section class="panel" data-seeding-view><div class="section-heading"><div><h2>Pool & practice seeding</h2>${disclaimer()}</div>${badge("Practice rules")}</div><div class="form-grid">${selectField("Pool lanes", "lanes", m.lanes, [4, 6, 8, 10])}${field("Lane preference order", "laneOrder", m.laneOrder.join(", "))}<label>Circle seeding ${badge("Pro")}<select data-meet="circleHeats" ${!canUse("circleSeeding", state.tier) ? "disabled" : ""}>${options([0, 2, 3], canUse("circleSeeding", state.tier) ? m.circleHeats : 0)}</select></label><label>Minimum slowest heat<input value="3 swimmers (when multiple heats)" disabled></label></div></section>
  <section class="panel"><h2>Booking & timing assumptions</h2><div class="form-grid">${field("Pool opens", "poolBooking.start", m.poolBooking.start, "time")}${field("Pool closes", "poolBooking.end", m.poolBooking.end, "time")}${field("Between heats (seconds)", "timing.gapBetweenHeatsS", m.timing.gapBetweenHeatsS, "number", 'min="0" step="1"')}${field("Between events (seconds)", "timing.gapBetweenEventsS", m.timing.gapBetweenEventsS, "number", 'min="0" step="1"')}<label>Pessimistic swim factor<input value="1.05 × (fixed practice assumption)" disabled></label><label>Club name for print ${badge("Pro")}<input id="brand-name" value="${escape(state.brand)}" ${!canUse("brandedPrint", state.tier) ? "disabled" : ""}></label></div><p class="hint">Gaps include the final heat and event. Same-day booking only. No fatigue-spacing or schedule optimization.</p></section>`;
}
