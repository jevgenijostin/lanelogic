import "./style.css";
import { parseTime, importCSV } from "./parsing";
import { LANE_ORDER } from "./seeding";
import { canUse } from "./features";
import {
  initialState,
  STORAGE_KEY,
  importJSON,
  exportJSON,
  checkState,
  clearResults,
  type AppState,
} from "./state";
import {
  solveAction,
  brandedPrint,
  type Request,
  type WorkerResult,
} from "./actions";
import { savingsDemo } from "./demo";
import { escape, button, options, disclaimer, assertDisclaimer } from "./ui";
import { roster, setup } from "./roster-setup";
import { lineups } from "./lineups-view";
import { heats, heatContent, timelineView, about } from "./reports-views";
const screens = [
  "Roster",
  "Meet setup",
  "Relay lineups",
  "Heat sheets",
  "Timeline",
  "About / rules",
];
const hashes = ["roster", "setup", "lineups", "heats", "timeline", "about"];
const app = document.querySelector<HTMLDivElement>("#app")!;
let state = initialState();
let startupMessage = "";
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) state = importJSON(saved);
} catch (error) {
  startupMessage = `Saved data could not be loaded. It has not been overwritten. ${(error as Error).message}`;
}
let screen = Math.max(0, hashes.indexOf(location.hash.slice(1)));
let busy = false,
  message = startupMessage,
  isError = !!startupMessage,
  elapsed = 0,
  pingCount = 0;
let worker: Worker | undefined;
let rejectPending: ((reason: Error) => void) | undefined;
let nextId = 0;
function notify(text: string, error = false) {
  message = text;
  isError = error;
  const target = document.querySelector("#notice");
  if (target) {
    target.textContent = text;
    target.className = error
      ? "notice error screen-only"
      : "notice screen-only";
    target.setAttribute("role", error ? "alert" : "status");
  }
}
function persist(next: AppState) {
  checkState(next);
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, exportJSON(state));
  } catch {
    notify(
      "This change is only in memory: browser storage is unavailable. Export a JSON backup.",
      true,
    );
    return false;
  }
  return true;
}
function edit(change: (next: AppState) => void, invalidates = true) {
  if (busy) throw Error("Wait for the solve to finish, or cancel it.");
  const next = structuredClone(state);
  change(next);
  if (invalidates) clearResults(next);
  if (persist(next))
    notify(
      invalidates
        ? "Saved locally. Solve again to update lineups."
        : "Saved locally.",
    );
}
const request: Request = (input, compare) =>
  new Promise((resolve, reject) => {
    worker ??= new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const id = ++nextId;
    const timer = setTimeout(() => {
      worker?.terminate();
      worker = undefined;
      rejectPending = undefined;
      reject(
        Error(
          "Solve exceeded the 30-second UI limit. Reduce the meet or relax constraints.",
        ),
      );
    }, 30000);
    rejectPending = (reason) => {
      clearTimeout(timer);
      reject(reason);
    };
    worker.onmessage = (e) => {
      if (e.data.id !== id) return;
      clearTimeout(timer);
      rejectPending = undefined;
      resolve(e.data as WorkerResult);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      rejectPending = undefined;
      worker?.terminate();
      worker = undefined;
      reject(Error(e.message || "Solver Worker failed to load"));
    };
    worker.postMessage({ id, input, compare, limits: { timeS: 8 } });
  });
async function runSolve(relayId?: string) {
  if (busy) return;
  busy = true;
  elapsed = 0;
  message = "Solving in a Worker. You can navigate or check responsiveness.";
  isError = false;
  render();
  const start = performance.now();
  try {
    const next = await solveAction(state, request, relayId);
    elapsed = performance.now() - start;
    if (persist(next))
      notify(
        `${next.solution!.status.replaceAll("_", " ")} · ${next.solution!.teams.length} teams · ${Math.round(elapsed)} ms. Saved locally.`,
      );
  } catch (error) {
    notify((error as Error).message, true);
  } finally {
    busy = false;
    render();
  }
}
function render() {
  const m = state.input.meet;
  app.innerHTML = `<a class="skip-link" href="#content">Skip to content</a><aside class="sidebar screen-only"><a class="brand" href="#roster"><span class="brand-mark" aria-hidden="true">≋</span><span>LaneLogic<small>THE RELAY PLANNER</small></span></a><div class="workspace-label">CLUB WORKSPACE</div><nav aria-label="Main navigation">${screens.map((name, i) => `<button data-screen="${i}" ${screen === i ? 'aria-current="page"' : ""}><span class="nav-number">0${i + 1}</span>${name}${[3, 4].includes(i) ? '<span class="pro-dot">PRO</span>' : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><span class="local-dot"></span> Local by design<p>Your roster stays in this browser.<br>Export a backup to take it with you.</p></div></aside>
  <div class="workspace"><header class="topbar screen-only"><div><span class="breadcrumb">Workspace / </span>${screens[screen]}</div><div class="top-actions"><label class="tier-label">Preview tier <select id="tier" ${busy ? "disabled" : ""}>${options(["free", "pro"], state.tier)}</select></label>${button("Export JSON", "export")}${button("Import JSON", "import", "", busy)}<input hidden type="file" id="json-file" accept=".json,application/json"></div></header>
  <main id="content"><div class="page-heading screen-only"><div><p class="eyebrow">PRACTICE MEET · ${escape(m.ageUpDate)}</p><h1>${screens[screen]}</h1><p class="subtitle">${escape(m.name)}</p></div><span class="meet-badge">${state.input.swimmers.length} swimmers <span> / </span>${state.input.relays.length} relays</span></div>
  <div id="notice" class="notice ${isError ? "error" : ""} screen-only" role="${isError ? "alert" : "status"}">${escape(message)}</div>
  <div class="solve-strip screen-only" ${!busy ? "hidden" : ""}><span class="spinner"></span><strong>Allocating lineups…</strong><span>HiGHS · Web Worker</span>${button("Cancel solve", "cancel")}</div>
  <div id="screen" data-view="${screen}">${[() => roster(state, busy), () => setup(state, busy), () => lineups(state, busy, elapsed), () => heats(state), () => timelineView(state), () => about(state, busy)][screen]()}</div>
  <footer class="screen-only"><span>LaneLogic / explicit rules, auditable lineups</span><div><button id="ping" type="button">Check UI response</button><output id="pong" aria-live="polite">${pingCount ? `Pong ${pingCount}${busy ? " · during solve" : ""}` : "Ready"}</output></div></footer>
  </main></div><div id="print-root" class="print-only">${disclaimer()}<p>Choose Heat sheets → Branded print in Pro to prepare a club sheet.</p></div>`;
  if ([1, 3].includes(screen))
    assertDisclaimer(document.querySelector("#screen")!);
  app
    .querySelectorAll("[data-seeding-view], [data-heat-event]")
    .forEach(assertDisclaimer);
  assertDisclaimer(document.querySelector("#print-root")!);
  if (busy)
    app
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input:not([type=file]), select",
      )
      .forEach((el) => {
        el.disabled = true;
      });
}
function navigate(i: number) {
  screen = i;
  location.hash = hashes[i];
  render();
}
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function preparePrint() {
  brandedPrint(state.tier, () => {
    const root = document.querySelector("#print-root")!;
    root.innerHTML = `<div class="print-heading"><strong>${escape(state.brand || "Swim club")}</strong><span>LaneLogic · Practice heat sheets</span></div><h1>${escape(state.input.meet.name)}</h1>${disclaimer()}<p>${escape(state.input.meet.ageUpDate)} · ${state.input.meet.lanes} lanes · ${state.solvedRelays.length}/${state.input.relays.length} events solved</p>${heatContent(state)}`;
    assertDisclaimer(root);
    root.querySelectorAll("[data-heat-event]").forEach(assertDisclaimer);
  });
}
window.addEventListener("beforeprint", () => {
  const root = document.querySelector("#print-root")!;
  if (canUse("brandedPrint", state.tier) && state.solution?.teams.length)
    preparePrint();
  else
    root.innerHTML = `${disclaimer()}<p>Club-branded heat sheets require Pro and solved lineups.</p>`;
  assertDisclaimer(root);
});
window.addEventListener("hashchange", () => {
  const i = hashes.indexOf(location.hash.slice(1));
  if (i >= 0 && i !== screen) {
    screen = i;
    render();
  }
});
app.addEventListener("click", async (event) => {
  const el = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!el || el.disabled) return;
  try {
    if (el.id === "ping") {
      pingCount++;
      document.querySelector("#pong")!.textContent =
        `Pong ${pingCount}${busy ? " · during solve" : ""}`;
      return;
    }
    if (el.dataset.screen !== undefined) {
      navigate(+el.dataset.screen);
      return;
    }
    const action = el.dataset.action;
    if (action === "cancel") {
      worker?.terminate();
      worker = undefined;
      rejectPending?.(Error("Solve cancelled. Previous lineups kept."));
      rejectPending = undefined;
      return;
    }
    if (action === "export") {
      download(exportJSON(state), "lanelogic-meet.json", "application/json");
      notify("JSON backup exported.");
      return;
    }
    if (action === "import" || action === "csv") {
      document
        .querySelector<HTMLInputElement>(
          action === "import" ? "#json-file" : "#csv-file",
        )!
        .click();
      return;
    }
    if (action === "solve-all") {
      await runSolve();
      return;
    }
    if (action?.startsWith("solve:")) {
      await runSolve(state.input.relays[+action.split(":")[1]].id);
      return;
    }
    if (action === "print" || action === "print-preview") {
      preparePrint();
      if (action === "print") brandedPrint(state.tier, () => window.print());
      else {
        const dialog = document.createElement("dialog");
        dialog.className = "print-dialog";
        dialog.innerHTML = `<div class="toolbar"><h2>Print preview</h2><button autofocus data-close-preview>Close preview</button></div>${document.querySelector("#print-root")!.innerHTML}`;
        app.append(dialog);
        assertDisclaimer(dialog);
        dialog.querySelectorAll("[data-heat-event]").forEach(assertDisclaimer);
        dialog.showModal();
        dialog.querySelector("button")!.onclick = () => dialog.remove();
        dialog.addEventListener("cancel", () => dialog.remove());
      }
      return;
    }
    if (busy) throw Error("Wait for the solve to finish, or cancel it.");
    if (action === "pro")
      edit((s) => {
        s.tier = "pro";
      }, false);
    if (action === "clear-results") edit(clearResults);
    if (action === "add-swimmer")
      edit((s) =>
        s.input.swimmers.push({
          id: crypto.randomUUID(),
          name: "New swimmer",
          sex: "F",
          dob: "2010-01-01",
          individualEntries: 0,
          times: {},
        }),
      );
    if (action === "add-relay")
      edit((s) =>
        s.input.relays.push({
          id: crypto.randomUUID(),
          name: "New relay",
          kind: "free",
          gender: "X",
          legDist: 50,
          teams: 1,
          priority: 1,
        }),
      );
    if (
      action === "sample" ||
      action === "empty" ||
      action === "savings-demo"
    ) {
      const next = initialState();
      next.tier = state.tier;
      next.brand = state.brand;
      if (action === "empty") {
        next.input.swimmers = [];
        next.input.relays = [];
        next.input.meet.name = "New practice meet";
      }
      if (action === "savings-demo") next.input = savingsDemo();
      if (persist(next)) notify("Workspace replaced and saved locally.");
    }
    if (action === "csv-template")
      download(
        "id,name,sex,dob,individualEntries,free50,back50,breast50,fly50\ns1,Alex Bauer,M,2010-01-01,0,28.45,32.50,NT,30.20\n",
        "roster-template.csv",
        "text/csv",
      );
    if (el.dataset.removeSwimmer !== undefined)
      edit((s) => {
        const [removed] = s.input.swimmers.splice(
          +el.dataset.removeSwimmer!,
          1,
        );
        s.input.locks = s.input.locks.filter((l) => l.swimmerId !== removed.id);
      });
    if (el.dataset.removeRelay !== undefined)
      edit((s) => {
        const [removed] = s.input.relays.splice(+el.dataset.removeRelay!, 1);
        s.input.locks = s.input.locks.filter(
          (l) => l.team.relayId !== removed.id,
        );
      });
    if (el.dataset.removeLock !== undefined)
      edit((s) => {
        s.input.locks.splice(+el.dataset.removeLock!, 1);
      });
    if (el.dataset.pin) {
      const [ri, slot, leg] = el.dataset.pin.split(",").map(Number);
      const relayId = state.input.relays[ri].id;
      const swimmerId = state
        .solution!.teams.find(
          (t) => t.team.relayId === relayId && t.team.slot === slot,
        )!
        .legs.find((l) => l.leg === leg)!.swimmerId;
      edit((s) =>
        s.input.locks.push({
          swimmerId,
          team: { relayId, slot },
          leg,
          mode: "pin",
        }),
      );
    }
    if (el.hasAttribute("data-close-preview")) return;
    render();
  } catch (error) {
    notify((error as Error).message, true);
  }
});
app.addEventListener("change", async (event) => {
  const el = event.target as HTMLInputElement;
  try {
    if (el.id === "json-file" || el.id === "csv-file") {
      const file = el.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (busy) throw Error("Finish or cancel the solve before importing.");
      if (el.id === "json-file") {
        const next = importJSON(text);
        if (persist(next)) notify("JSON backup imported and validated.");
      } else {
        const result = importCSV(text);
        if (result.errors.length) throw Error(result.errors.join("\n"));
        edit((s) => {
          s.input.swimmers = result.swimmers;
          s.input.locks = [];
        });
      }
    } else if (el.id === "tier")
      edit((s) => {
        s.tier = el.value as AppState["tier"];
      }, false);
    else if (el.id === "brand-name") {
      if (!canUse("brandedPrint", state.tier))
        throw Error("Club branding requires Pro");
      edit((s) => {
        s.brand = el.value;
      }, false);
    } else if (el.dataset.swimmer !== undefined)
      edit((s) => {
        const swimmer = s.input.swimmers[+el.dataset.swimmer!];
        if (el.dataset.time) {
          const cs = parseTime(el.value.trim().toUpperCase());
          if (cs === undefined) delete swimmer.times[el.dataset.time];
          else swimmer.times[el.dataset.time] = cs;
        } else {
          const key = el.dataset.field!;
          Object.assign(swimmer, {
            [key]: key === "individualEntries" ? Number(el.value) : el.value,
          });
        }
      });
    else if (el.dataset.relay !== undefined)
      edit((s) => {
        const relay = s.input.relays[+el.dataset.relay!];
        const key = el.dataset.field!;
        if (
          ["ageMin", "ageMax", "ageSumMin", "ageSumMax"].includes(key) &&
          !el.value.trim()
        )
          delete (relay as unknown as Record<string, unknown>)[key];
        else
          Object.assign(relay, {
            [key]: ["name", "kind", "gender"].includes(key)
              ? el.value
              : Number(el.value),
          });
      });
    else if (el.dataset.meet)
      edit((s) => {
        const path = el.dataset.meet!;
        if (path === "circleHeats" && !canUse("circleSeeding", s.tier))
          throw Error("Circle seeding requires Pro");
        const keys = path.split(".");
        const obj =
          keys.length === 2
            ? (
                s.input.meet as unknown as Record<
                  string,
                  Record<string, unknown>
                >
              )[keys[0]]
            : (s.input.meet as unknown as Record<string, unknown>);
        const key = keys.at(-1)!;
        obj[key] =
          path === "laneOrder"
            ? el.value.split(",").map((v) => Number(v.trim()))
            : typeof obj[key] === "number"
              ? Number(el.value)
              : el.value;
        if (path === "lanes")
          s.input.meet.laneOrder = [...LANE_ORDER[s.input.meet.lanes]];
      });
    else return;
    render();
  } catch (error) {
    render();
    notify((error as Error).message, true);
  }
});
app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id !== "lock-form") return;
  try {
    const data = new FormData(form);
    const [ri, slot] = String(data.get("team")).split(",").map(Number);
    edit((s) =>
      s.input.locks.push({
        swimmerId: String(data.get("swimmer")),
        team: { relayId: s.input.relays[ri].id, slot },
        leg: Number(data.get("leg")) - 1,
        mode: data.get("mode") as "pin" | "ban",
      }),
    );
    render();
  } catch (error) {
    notify((error as Error).message, true);
  }
});
render();
