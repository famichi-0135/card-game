export type HudColorVariant = "gray" | "red" | "blue" | "gold" | "green";

export const hudVariantTextClasses: Record<HudColorVariant, string> = {
  gray: "text-[#8b8f96]",
  red: "text-[#e24a4a]",
  blue: "text-[#4a8bff]",
  gold: "text-[#ffc857]",
  green: "text-[#4fc46a]",
};

export const hudVariantGlowColors: Record<HudColorVariant, string> = {
  gray: "#8b8f96",
  red: "#e24a4a",
  blue: "#4a8bff",
  gold: "#ffc857",
  green: "#4fc46a",
};
