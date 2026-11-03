import type { AppState } from "./state";
import { formatTime } from "./parsing";
import { canUse, type Feature } from "./features";
import { heatSheets, sessionTimeline } from "./actions";
import { escape, button, badge, disclaimer, empty } from "./ui";
export function gate(state: AppState, feature: Feature, content: () => string) {
  if (canUse(feature, state.tier)) return content();
  return `<section class="panel upgrade"><span class="eyebrow">ONE MEET. THE WHOLE PICTURE.</span><h2>Plan together with Pro.</h2><p>Joint allocation, savings comparisons, heat sheets, circle seeding, a session timeline, and club-branded print.</p>${button("Try Pro preview", "pro", "primary")}<p class="hint">Tonight’s switch is a feature flag. No payment or license enforcement.</p></section>`;
}
export function heatContent(state: AppState) {
  return heatSheets(state)
    .map(
      ({ relay, heats }, i) =>
        `<section class="panel heat-event" data-heat-event><div class="section-heading"><div><span class="eyebrow">EVENT ${String(i + 1).padStart(2, "0")}</span><h2>${escape(relay.name)}</h2></div>${badge(`${heats.length} heat${heats.length !== 1 ? "s" : ""}`)}</div>${disclaimer()}${
          heats.length
            ? heats
                .map(
                  (h) =>
                    `<div class="heat"><h3>Heat ${h.number} <span class="hint">/ ${heats.length} · ${state.input.meet.circleHeats ? `Circle ${state.input.meet.circleHeats} when enough heats` : "Straight seeding"}</span></h3><div class="table-scroll"><table><thead><tr><th>Lane</th><th>Team</th><th>Swimmers in leg order</th><th>Seed time</th></tr></thead><tbody>${Array.from(
                      { length: state.input.meet.lanes },
                      (_, lane) => {
                        const entry = h.lanes.find(
                          (l) => l.lane === lane + 1,
                        )?.entry;
                        const t = state.solution?.teams.find(
                          (t) =>
                            `${t.team.relayId}:${t.team.slot}` === entry?.id,
                        );
                        return `<tr class="${entry ? "" : "empty-lane"}"><td><span class="lane-number">${lane + 1}</span></td><td>${t ? `Team ${String.fromCharCode(65 + t.team.slot)}` : "—"}</td><td>${t ? t.legs.map((l) => escape(state.input.swimmers.find((s) => s.id === l.swimmerId)?.name)).join(" · ") : "Open lane"}</td><td class="split">${entry ? formatTime(entry.seedCs) : "—"}</td></tr>`;
                      },
                    ).join("")}</tbody></table></div></div>`,
                )
                .join("")
            : `<p class="hint">${state.solvedRelays.includes(relay.id) ? "No teams fielded." : "Event not solved. Solve this relay or the whole meet first."}</p>`
        }</section>`,
    )
    .join("");
}
export function heats(state: AppState) {
  return `${disclaimer()}${gate(state, "heatSheets", () => `<div class="action-bar"><div><h2>Ready for the pool deck.</h2><p class="hint">Fastest heat swims last. Lane preference: ${state.input.meet.laneOrder.join(" → ")}.</p></div><div class="toolbar">${button("Print preview", "print-preview", "", !state.solution?.teams.length)}${button("Branded print", "print", "primary", !state.solution?.teams.length)}</div></div>${!state.solution?.teams.length ? empty("No seeded teams yet.", "Solve a relay to build its practice heat sheet.") : ""}${heatContent(state)}`)}`;
}
export function timelineView(state: AppState) {
  return gate(state, "timeline", () => {
    if (!state.solution?.teams.length)
      return empty(
        "Give your session a shape.",
        "Solve lineups first. The timeline estimates only fielded relay heats.",
      );
    const t = sessionTimeline(state);
    const events = heatSheets(state).filter((e) => e.heats.length);
    const m = state.input.meet;
    const mins = (s: number) => `${(s / 60).toFixed(1)} min`;
    const durations = events.map(
      (e) =>
        e.heats.reduce(
          (sum, h) =>
            sum +
            Math.max(...h.lanes.map((l) => l.entry.seedCs! / 100)) +
            m.timing.gapBetweenHeatsS,
          0,
        ) + m.timing.gapBetweenEventsS,
    );
    let offset = 0;
    return `<div class="metrics"><article><span>EXPECTED SESSION</span><strong>${mins(t.expectedS)}</strong><small>Swim times + configured gaps</small></article><article><span>PESSIMISTIC</span><strong>${mins(t.pessimisticS)}</strong><small>5% slower swim times</small></article><article><span>POOL BOOKING</span><strong>${mins(t.bookingS)}</strong><small>${m.poolBooking.start} – ${m.poolBooking.end}</small></article></div><aside class="${t.overrun || t.pessimisticOverrun ? "notice error" : "savings"}" id="overrun"><strong>${t.overrun ? `Overrun: ${mins(t.overrunS)}` : t.pessimisticOverrun ? `Pessimistic overrun: ${mins(t.pessimisticOverrunS)}` : `${mins(-t.pessimisticOverrunS)} to spare`}</strong><span>${t.overrun || t.pessimisticOverrun ? "The session exceeds the pool booking. Adjust the plan or extend the booking." : "Pessimistic estimate fits inside the booking."}</span></aside><section class="panel"><h2>Session against booking</h2><p class="hint">${state.solvedRelays.length} / ${state.input.relays.length} events solved. Unsolved and unfielded events are excluded.</p><div class="time-axis"><span>${m.poolBooking.start}</span><span>${t.pessimisticOverrun ? `Session extends past ${m.poolBooking.end}` : `Booking closes ${m.poolBooking.end}`}</span></div><div class="session-track" role="img" aria-label="Expected duration ${mins(t.expectedS)} of ${mins(t.bookingS)} booking"><i class="booking-marker" style="left:${Math.min(99.7, (t.bookingS / Math.max(t.bookingS, t.pessimisticS)) * 100)}%" title="Booking closes ${m.poolBooking.end}"></i>${events.map((e, i) => `<span style="width:${(durations[i] / Math.max(t.bookingS, t.pessimisticS)) * 100}%;--event-color:${["#157a79", "#27667e", "#508b94", "#9b6d3c", "#607b4b", "#766891"][i % 6]}" title="${escape(e.relay.name)}: ${mins(durations[i])}">${i + 1}</span>`).join("")}</div><div class="legend"><span>■ Expected ${mins(t.expectedS)}</span><span>□ Pessimistic ${mins(t.pessimisticS)}</span></div><div class="table-scroll"><table><thead><tr><th>Event</th><th>Start offset</th><th>Heats</th><th>Expected duration</th></tr></thead><tbody>${events
      .map((e, i) => {
        const start = offset;
        offset += durations[i];
        return `<tr><th>${escape(e.relay.name)}</th><td>+${mins(start)}</td><td>${e.heats.length}</td><td>${mins(durations[i])}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="hint">Estimate only. Includes final heat/event gaps; excludes individual events, breaks, warm-up and fatigue spacing. Event order follows meet setup.</p></section>`;
  });
}
export function about(state: AppState, busy: boolean) {
  const rules = [
    ["C1", "All four legs filled, or team not fielded"],
    ["C2", "Four distinct swimmers in each team"],
    ["C3", "A swimmer appears once per relay event"],
    [
      "C4",
      `Relay entries + individual entries ≤ ${state.input.meet.relayLimitPerSwimmer}`,
    ],
    ["C5", "B requires A; C requires B"],
    ["C6", "Mixed relays require exactly two male and two female swimmers"],
    ["C7", "Individual age and summed-age bounds are applied"],
    ["C8", "Pins are required; banned swimmer/leg assignments are excluded"],
    ["Times", "NT excludes a swimmer from that stroke and distance"],
    [
      "Objective",
      "Maximize weighted teams, then minimize raw time, then fixed hash tie-break",
    ],
  ];
  return `<section class="panel about-intro"><span class="eyebrow">LESS ADMIN. MORE TIME ON DECK.</span><h2>A clear plan. With the checks to back it up.</h2><p>LaneLogic assigns relay legs using your explicit eligibility inputs. Every returned lineup is independently validated. This checks the model, not federation regulations.</p>${disclaimer()}</section><section class="panel"><h2>Active rules</h2><div class="table-scroll"><table><thead><tr><th>Rule</th><th>What LaneLogic checks</th></tr></thead><tbody>${rules.map(([rule, text]) => `<tr><th>${rule}</th><td>${escape(text)}</td></tr>`).join("")}</tbody></table></div></section><div class="two-columns"><section class="panel"><h2>Assumptions, made visible</h2><ul class="reading-list"><li>Whole-year ages on ${state.input.meet.ageUpDate}.</li><li>Medley order: back, breast, fly, free.</li><li>Flying starts subtract ${state.input.meet.startSplitAdjustCs} cs on legs 2–4 in reporting only.</li><li>Weighted coverage outranks speed. Missing times may leave teams unfielded.</li><li>Sequential solves preserve earlier accepted teams; they do not claim a joint optimum.</li><li>Practice heats use center-first lanes, slowest first, and a minimum of three entries in the slowest of multiple heats.</li><li>Timeline uses the slowest team in each heat, configured gaps, and a 1.05 pessimistic swim factor.</li><li>Local data only. Clearing browser data removes this workspace; keep JSON backups.</li></ul></section><section class="panel"><h2>Free & Pro preview</h2><p><strong>Free:</strong> roster, setup, one-relay sequential solve, basic lineup cards.</p><p><strong>Pro:</strong> joint solve, savings banner, heat sheets, circle seeding, timeline and club-branded print.</p><p class="notice">The tier selector is a demo feature flag, not real license enforcement. No payment is collected.</p><h3>Deliberate limits</h3><p class="hint">No federation compliance, meet-points objective, individual-event optimization, fatigue spacing or coupled scheduling. Meet Manager / HY3 / CL2 support is the first interoperability follow-up. No PDF library, season history, accounts or license cryptography.</p></section></div><details class="panel compact"><summary>Solver & demonstration</summary><p class="hint">Pinned HiGHS WASM runs locally in a Web Worker. The 40-swimmer / 6-relay sample is a measured case, not a universal size guarantee. Feasible means a valid incumbent, not proven optimal. Each solve uses an 8-second engine budget; the UI cancels at 30 seconds including comparison/diagnostics.</p>${button("Load savings demonstration", "savings-demo", "", busy)}<p class="hint">Replaces this workspace with an eight-swimmer specialist-allocation fixture. Switch to Pro and solve the whole meet to compare.</p><a href="./engine.html">Open engine verification lab</a></details>`;
}
