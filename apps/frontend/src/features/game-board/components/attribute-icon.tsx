import type { Attribute, Faction } from "@disastar/game-engine";
import {
  Droplets,
  Handshake,
  Mountain,
  PackageCheck,
  ShieldCheck,
  Wind,
} from "lucide-react";

export function AttributeIcon({
  attribute,
  faction,
  size = 15,
}: {
  attribute: Attribute;
  faction: Faction;
  size?: number;
}) {
  const Icon =
    faction === "disaster"
      ? {
          attributeA: Mountain,
          attributeB: Droplets,
          attributeC: Wind,
        }[attribute]
      : {
          attributeA: PackageCheck,
          attributeB: ShieldCheck,
          attributeC: Handshake,
        }[attribute];

  return (
    <Icon
      aria-hidden="true"
      data-attribute-icon={attribute}
      focusable="false"
      size={size}
      strokeWidth={1.7}
    />
  );
}
