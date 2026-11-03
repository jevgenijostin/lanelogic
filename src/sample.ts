import { savingsDemo } from "./demo";
import type { Input } from "./domain";
export function sampleMeet(): Input {
  const p = savingsDemo();
  p.meet.name = "Northside • November practice";
  p.meet.ageUpDate = "2026-11-03";
  p.meet.relayLimitPerSwimmer = 3;
  p.meet.startSplitAdjustCs = 30;
  const names = [
    "Alex",
    "Maya",
    "Leo",
    "Sofia",
    "Noah",
    "Ella",
    "Finn",
    "Amira",
    "Oscar",
    "Lily",
  ];
  const surnames = ["Bauer", "Klein", "Fischer", "Weber"];
  p.swimmers = Array.from({ length: 40 }, (_, i) => ({
    id: `s${i}`,
    name: `${names[i % 10]} ${surnames[Math.floor(i / 10)]}`,
    sex: i % 2 ? "F" : "M",
    dob: "2010-01-01",
    individualEntries: 0,
    times: {
      free50: 2500 + i * 30,
      back50: 3000 + i * 20,
      breast50: 3500 + i * 40,
      fly50: 2900 + i * 25,
    },
  }));
  p.relays = Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    name: `${["Men’s", "Women’s", "Mixed"][i % 3]} 4 × 50 ${i % 2 ? "medley" : "freestyle"}`,
    kind: i % 2 ? "medley" : "free",
    legDist: 50,
    gender: (["M", "F", "X"] as const)[i % 3],
    teams: 2,
    priority: 1 + i,
  }));
  return p;
}
