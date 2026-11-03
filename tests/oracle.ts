import type { Input } from "../src/domain";
// Exhaustive ordered four-swimmer enumeration. No MILP/model/validator imports.
// Equal member sets retain only their lowest raw time; future choices depend on members only.
export function oracle(p: Input): { weight: number; costCs: number } | null {
  if (p.swimmers.some((s) => s.individualEntries > p.meet.relayLimitPerSwimmer))
    return null;
  const teams = p.relays.flatMap((r) =>
    Array.from({ length: r.teams }, (_, slot) => ({ r, slot })),
  );
  const candidates = teams.map(({ r, slot }) => {
    const byMembers = new Map<number, { mask: number; cost: number }>();
    function visit(ids: number[], cost: number) {
      const leg = ids.length;
      if (leg === 4) {
        const swimmers = ids.map((i) => p.swimmers[i]);
        const ages = swimmers.map(
          (s) =>
            +p.meet.ageUpDate.slice(0, 4) -
            +s.dob.slice(0, 4) -
            (p.meet.ageUpDate.slice(5) < s.dob.slice(5) ? 1 : 0),
        );
        if (
          r.gender === "X" &&
          swimmers.filter((s) => s.sex === "M").length !== 2
        )
          return;
        const sum = ages.reduce((a, b) => a + b, 0);
        if (sum < (r.ageSumMin ?? 0) || sum > (r.ageSumMax ?? Infinity)) return;
        const mask = ids.reduce((a, i) => a | (1 << i), 0);
        if (cost < (byMembers.get(mask)?.cost ?? Infinity))
          byMembers.set(mask, { mask, cost });
        return;
      }
      p.swimmers.forEach((s, i) => {
        if (ids.includes(i)) return;
        const a =
          +p.meet.ageUpDate.slice(0, 4) -
          +s.dob.slice(0, 4) -
          (p.meet.ageUpDate.slice(5) < s.dob.slice(5) ? 1 : 0);
        const cs =
          s.times[
            `${r.kind === "free" ? "free" : ["back", "breast", "fly", "free"][leg]}${r.legDist}`
          ];
        if (
          cs === undefined ||
          (r.gender !== "X" && s.sex !== r.gender) ||
          a < (r.ageMin ?? 0) ||
          a > (r.ageMax ?? Infinity)
        )
          return;
        if (
          p.locks.some(
            (k) =>
              k.team.relayId === r.id &&
              k.team.slot === slot &&
              k.leg === leg &&
              (k.mode === "pin" ? k.swimmerId !== s.id : k.swimmerId === s.id),
          )
        )
          return;
        visit([...ids, i], cost + cs);
      });
    }
    visit([], 0);
    return [...byMembers.values()];
  });
  if (
    p.locks.some(
      (k) =>
        k.mode === "pin" &&
        (!teams.some(
          (t) => t.r.id === k.team.relayId && t.slot === k.team.slot,
        ) ||
          ![0, 1, 2, 3].includes(k.leg) ||
          !p.swimmers.some((s) => s.id === k.swimmerId)),
    )
  )
    return null;
  const memo = new Map<string, { weight: number; costCs: number } | null>();
  function search(
    t: number,
    usage: number[],
    eventMask: number,
    previous: boolean,
  ): { weight: number; costCs: number } | null {
    if (t === teams.length) return { weight: 0, costCs: 0 };
    const { r, slot } = teams[t];
    if (slot === 0) {
      eventMask = 0;
      previous = true;
    }
    const key = `${t}/${usage}/${eventMask}/${previous}`;
    if (memo.has(key)) return memo.get(key)!;
    let best: { weight: number; costCs: number } | null = null;
    const pinned = p.locks.some(
      (k) =>
        k.mode === "pin" && k.team.relayId === r.id && k.team.slot === slot,
    );
    if (!pinned) best = search(t + 1, usage, eventMask, false);
    if (previous)
      for (const c of candidates[t]) {
        if (c.mask & eventMask) continue;
        const next = [...usage];
        let ok = true;
        for (let i = 0; i < next.length; i++)
          if (c.mask & (1 << i)) {
            next[i]++;
            if (
              next[i] >
              p.meet.relayLimitPerSwimmer - p.swimmers[i].individualEntries
            )
              ok = false;
          }
        if (!ok) continue;
        const tail = search(t + 1, next, eventMask | c.mask, true);
        if (!tail) continue;
        const result = {
          weight: tail.weight + r.priority,
          costCs: tail.costCs + c.cost,
        };
        if (
          !best ||
          result.weight > best.weight ||
          (result.weight === best.weight && result.costCs < best.costCs)
        )
          best = result;
      }
    memo.set(key, best);
    return best;
  }
  return search(
    0,
    p.swimmers.map(() => 0),
    0,
    true,
  );
}
