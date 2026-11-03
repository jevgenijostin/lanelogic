import type { Heat } from "./seeding";
export interface Timing {
  gapBetweenHeatsS: number;
  gapBetweenEventsS: number;
  ntEstimateS?: number;
}
export function timeline(
  events: Heat[][],
  booking: { start: string; end: string },
  timing: Timing,
) {
  const clock = (s: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error("Invalid booking");
    const [h, m] = s.split(":").map(Number);
    return h * 3600 + m * 60;
  };
  const bookingS = clock(booking.end) - clock(booking.start);
  if (bookingS <= 0)
    throw Error("Booking must end after start on the same day");
  if (
    [
      timing.gapBetweenHeatsS,
      timing.gapBetweenEventsS,
      timing.ntEstimateS ?? 0,
    ].some((n) => !Number.isFinite(n) || n < 0)
  )
    throw Error("Invalid timing");
  const duration = (factor: number) =>
    events.reduce(
      (sum, event) =>
        sum +
        event.reduce(
          (total, h) =>
            total +
            Math.max(
              0,
              ...h.lanes.map(({ entry }) => {
                if (
                  entry.seedCs === undefined &&
                  timing.ntEstimateS === undefined
                )
                  throw Error("NT requires an explicit duration estimate");
                return entry.seedCs === undefined
                  ? timing.ntEstimateS!
                  : entry.seedCs / 100;
              }),
            ) *
              factor +
            timing.gapBetweenHeatsS,
          0,
        ) +
        timing.gapBetweenEventsS,
      0,
    );
  const expectedS = duration(1),
    pessimisticS = duration(1.05);
  return {
    bookingS,
    expectedS,
    pessimisticS,
    overrunS: expectedS - bookingS,
    pessimisticOverrunS: pessimisticS - bookingS,
    overrun: expectedS > bookingS,
    pessimisticOverrun: pessimisticS > bookingS,
  };
}
