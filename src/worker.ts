import loadHighs from 'highs';
import wasmUrl from 'highs/runtime?url';
const ready = loadHighs({ locateFile: () => wasmUrl });
self.onmessage = async (event) => {
  try {
    const highs = await ready;
    const result = highs.solve(event.data.lp, { mip_rel_gap: 0, mip_abs_gap: 0 });
    self.postMessage({ id: event.data.id, status: result.Status, result });
  } catch (error) { self.postMessage({ id: event.data.id, error: String(error) }); }
};
