import loadHighs from "highs";
import wasmUrl from "highs/runtime?url";
import { solve } from "./solver";
import { sequential, compare } from "./sequential";
import { validate } from "./validator";
const ready = loadHighs({ locateFile: () => wasmUrl });
self.onmessage = async (event) => {
  try {
    const highs = await ready;
    if (event.data.input) {
      if (event.data.compare) {
        const joint = solve(event.data.input, highs, event.data.limits);
        const baseline = sequential(event.data.input, highs, event.data.limits);
        self.postMessage({
          id: event.data.id,
          joint,
          baseline,
          comparison: compare(joint, baseline),
          violations: validate(event.data.input, joint.teams),
        });
        return;
      }
      self.postMessage({
        id: event.data.id,
        solution: solve(event.data.input, highs, event.data.limits),
      });
      return;
    }
    const result = highs.solve(event.data.lp, {
      mip_rel_gap: 0,
      mip_abs_gap: 0,
    });
    self.postMessage({ id: event.data.id, status: result.Status, result });
  } catch (error) {
    self.postMessage({ id: event.data.id, error: String(error) });
  }
};
