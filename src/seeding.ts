export const DISCLAIMER = "Practice seeding — not federation-compliant.";
export const LANE_ORDER = {
  4: [2, 3, 1, 4],
  6: [3, 4, 2, 5, 1, 6],
  8: [4, 5, 3, 6, 2, 7, 1, 8],
  10: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10],
};
export interface Entry {
  id: string;
  seedCs?: number;
  entryOrder: number;
}
export interface Heat {
  number: number;
  lanes: { lane: number; entry: Entry }[];
}
export function seed(
  entries: Entry[],
  lanes: 4 | 6 | 8 | 10,
  circle: 0 | 2 | 3 = 0,
  laneOrder = LANE_ORDER[lanes],
): Heat[] {
  if (
    laneOrder.length !== lanes ||
    new Set(laneOrder).size !== lanes ||
    laneOrder.some((n) => !Number.isInteger(n) || n < 1 || n > lanes)
  )
    throw Error("Invalid lane order");
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    entries.some(
      (e) =>
        e.seedCs !== undefined &&
        (!Number.isSafeInteger(e.seedCs) || e.seedCs <= 0),
    )
  )
    throw Error("Invalid entries");
  const sorted = [...entries].sort(
    (a, b) =>
      (a.seedCs ?? Infinity) - (b.seedCs ?? Infinity) ||
      a.entryOrder - b.entryOrder,
  );
  const count = Math.ceil(entries.length / lanes);
  if (!count) return [];
  const sizes = Array<number>(count).fill(lanes);
  sizes[0] = entries.length - (count - 1) * lanes;
  if (count > 1 && sizes[0] < 3) {
    sizes[1] -= 3 - sizes[0];
    sizes[0] = 3;
  }
  const heats: Heat[] = sizes.map((_, i) => ({ number: i + 1, lanes: [] }));
  let index = 0;
  const add = (h: number) => {
    heats[h].lanes.push({
      lane: laneOrder[heats[h].lanes.length],
      entry: sorted[index++],
    });
  };
  let top = count - 1;
  if (circle && count >= circle) {
    const group = Array.from({ length: circle }, (_, i) => count - 1 - i);
    while (group.some((h) => heats[h].lanes.length < sizes[h]))
      for (const h of group) if (heats[h].lanes.length < sizes[h]) add(h);
    top -= circle;
  }
  for (let h = top; h >= 0; h--)
    while (heats[h].lanes.length < sizes[h]) add(h);
  return heats;
}
