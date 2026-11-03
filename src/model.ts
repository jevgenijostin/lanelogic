import { age, hash, key, strokes, type Input, type Team } from "./domain";
export function buildModel(p: Input) {
  const teams = p.relays.flatMap((r) =>
    Array.from({ length: r.teams }, (_, slot) => ({ relayId: r.id, slot })),
  );
  const vars: {
    name: string;
    i: number;
    t: number;
    l: number;
    c: number;
    h: number;
  }[] = [];
  const rows: string[] = [];
  const sum = (terms: string[]) => (terms.length ? terms.join(" + ") : "0 z");
  const row = (terms: string[], op: string, rhs: number) =>
    rows.push(`${sum(terms)} ${op} ${rhs}`);
  teams.forEach((t, ti) => {
    const r = p.relays.find((r) => r.id === t.relayId)!;
    p.swimmers.forEach((s, i) => {
      const a = age(s.dob, p.meet.ageUpDate);
      if (
        (r.gender !== "X" && s.sex !== r.gender) ||
        a < (r.ageMin ?? 0) ||
        a > (r.ageMax ?? Infinity)
      )
        return;
      strokes(r).forEach((stroke, l) => {
        const c = s.times[`${stroke}${r.legDist}`];
        if (
          c === undefined ||
          p.locks.some(
            (k) =>
              k.mode === "ban" &&
              k.swimmerId === s.id &&
              key(k.team) === key(t) &&
              k.leg === l,
          )
        )
          return;
        vars.push({
          name: `x${i}_${ti}_${l}`,
          i,
          t: ti,
          l,
          c,
          h: hash(`${s.id}/${key(t)}/${l}`),
        });
      });
    });
    for (let l = 0; l < 4; l++)
      rows.push(
        `${sum(vars.filter((v) => v.t === ti && v.l === l).map((v) => v.name))} - y${ti} = 0`,
      );
    p.swimmers.forEach((_, i) =>
      row(
        vars.filter((v) => v.t === ti && v.i === i).map((v) => v.name),
        "<=",
        1,
      ),
    );
    if (t.slot > 0) rows.push(`y${ti} - y${ti - 1} <= 0`);
    if (r.gender === "X")
      rows.push(
        `${sum(vars.filter((v) => v.t === ti && p.swimmers[v.i].sex === "M").map((v) => v.name))} - 2 y${ti} = 0`,
      );
    const ages = vars
      .filter((v) => v.t === ti)
      .map((v) => `${age(p.swimmers[v.i].dob, p.meet.ageUpDate)} ${v.name}`);
    if (r.ageSumMin !== undefined)
      rows.push(`${sum(ages)} - ${r.ageSumMin} y${ti} >= 0`);
    if (r.ageSumMax !== undefined)
      rows.push(`${sum(ages)} - ${r.ageSumMax} y${ti} <= 0`);
  });
  p.swimmers.forEach((s, i) => {
    row(
      vars.filter((v) => v.i === i).map((v) => v.name),
      "<=",
      p.meet.relayLimitPerSwimmer - s.individualEntries,
    );
    for (const r of p.relays)
      row(
        vars
          .filter((v) => v.i === i && teams[v.t].relayId === r.id)
          .map((v) => v.name),
        "<=",
        1,
      );
  });
  for (const lock of p.locks.filter((l) => l.mode === "pin")) {
    const v = vars.find(
      (v) =>
        p.swimmers[v.i].id === lock.swimmerId &&
        key(teams[v.t]) === key(lock.team) &&
        v.l === lock.leg,
    );
    row(v ? [v.name] : [], "=", 1);
  }
  const weight = sum(
    teams.map(
      (t, i) => `${p.relays.find((r) => r.id === t.relayId)!.priority} y${i}`,
    ),
  );
  const cost = sum(vars.map((v) => `${v.c} ${v.name}`));
  const tie = sum(vars.map((v) => `${v.h} ${v.name}`));
  const lp = (stage: number, w?: number, c?: number) =>
    `${stage === 1 ? "Maximize" : "Minimize"}\n obj: ${stage === 1 ? weight : stage === 2 ? cost : tie}\nSubject To\n${[...rows, ...(w === undefined ? [] : [`${weight} = ${w}`]), ...(c === undefined ? [] : [`${cost} = ${c}`])].map((r, i) => ` r${i}: ${r}`).join("\n")}\nBounds\n z = 0\nBinary\n ${[...teams.map((_, i) => `y${i}`), ...vars.map((v) => v.name)].join(" ")}\nEnd`;
  return { teams, vars, lp };
}
