import { savingsDemo } from "./demo";
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
const pending = new Map<number, (v: unknown) => void>();
let id = 0;
worker.onmessage = (e) => {
  pending.get(e.data.id)?.(e.data);
  pending.delete(e.data.id);
};
function solve(lp: string) {
  return new Promise((resolve) => {
    pending.set(++id, resolve);
    worker.postMessage({ id, lp });
  });
}
Object.assign(window, { solveLP: solve });
Object.assign(window, {
  solveMeet: (input: unknown, limits: unknown) =>
    new Promise((resolve) => {
      pending.set(++id, resolve);
      worker.postMessage({ id, input, limits });
    }),
});
document.querySelector("#run")!.addEventListener("click", async () => {
  document.querySelector("#output")!.textContent = JSON.stringify(
    await solve("Maximize\n obj: x\nSubject To\n c: x <= 1\nBinary\n x\nEnd"),
    null,
    2,
  );
});
document.querySelector("#compare")!.addEventListener("click", async () => {
  const output = document.querySelector("#output")!;
  const banner = document.querySelector("#savings")!;
  banner.textContent = "Solving in Worker…";
  const result: any = await new Promise((resolve) => {
    pending.set(++id, resolve);
    worker.postMessage({ id, input: savingsDemo(), compare: true });
  });
  if (result.error) {
    banner.textContent = result.error;
    return;
  }
  banner.textContent = `Joint vs sequential: ${(result.comparison.savedCs / 100).toFixed(2)} s saved`;
  document.querySelector("#checks")!.textContent =
    `Independent checks: ${result.violations.length === 0 ? "PASS — C1–C8, eligibility, caps and reported times" : result.violations.join(", ")}`;
  output.textContent = JSON.stringify(result, null, 2);
});
