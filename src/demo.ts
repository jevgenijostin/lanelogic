import type { Input } from "./domain";
/** Hand-checkable joint-vs-sequential fixture: raw totals 82.20 vs 351.00 seconds. */
export function savingsDemo(): Input {
  return {
    meet: {
      name: "Specialist allocation demo",
      ageUpDate: "2026-06-01",
      relayLimitPerSwimmer: 1,
      startSplitAdjustCs: 0,
      lanes: 6,
      laneOrder: [3, 4, 2, 5, 1, 6],
      circleHeats: 0,
      minSlowestHeat: 3,
      poolBooking: { start: "18:00", end: "20:00" },
      timing: { gapBetweenHeatsS: 20, gapBetweenEventsS: 60, pessimism: 1.05 },
    },
    swimmers: Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      name: `Swimmer ${i + 1}`,
      sex: "M",
      dob: "2010-01-01",
      individualEntries: 0,
      times: {
        free50: 1000 + i * 10,
        back50: i < 4 ? 1000 : 10000,
        breast50: i < 4 ? 1000 : 10000,
        fly50: i < 4 ? 1000 : 10000,
      },
    })),
    relays: [
      {
        id: "r0",
        name: "Free",
        kind: "free",
        gender: "M",
        legDist: 50,
        teams: 1,
        priority: 2,
      },
      {
        id: "r1",
        name: "Medley",
        kind: "medley",
        gender: "M",
        legDist: 50,
        teams: 1,
        priority: 1,
      },
    ],
    locks: [],
  };
}
