export type Tier = "free" | "pro";
export const features = [
  "roster",
  "relay",
  "lineups",
  "wholeMeet",
  "savings",
  "heatSheets",
  "circleSeeding",
  "timeline",
  "brandedPrint",
] as const;
export type Feature = (typeof features)[number];
export function canUse(feature: Feature, tier: Tier): boolean {
  return (
    features.includes(feature) &&
    (tier === "pro" ||
      (tier === "free" && ["roster", "relay", "lineups"].includes(feature)))
  );
}
export function requireFeature(feature: Feature, tier: Tier) {
  if (!canUse(feature, tier))
    throw Error(
      "This feature requires Pro. The tier switch is a demo flag, not a license.",
    );
}
