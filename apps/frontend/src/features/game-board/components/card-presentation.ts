import type { Attribute, PublicCardCatalog } from "@disastar/game-engine";

export const attributeLabels: Record<Attribute, string> = {
  attributeA: "属性A",
  attributeB: "属性B",
  attributeC: "属性C",
};

export function cardTypeLabel(cardType: "mana" | "attack" | "support"): string {
  switch (cardType) {
    case "mana":
      return "みなもと";
    case "attack":
      return "攻撃";
    case "support":
      return "サポート";
  }
}

export function cardTypeMark(cardType: "mana" | "attack" | "support"): string {
  switch (cardType) {
    case "mana":
      return "M";
    case "attack":
      return "A";
    case "support":
      return "S";
  }
}

export function getChainableCardNames(
  catalog: PublicCardCatalog,
  definition: NonNullable<PublicCardCatalog["definitions"][string]>,
): string[] {
  return definition.interaction.chainableCardDefinitionIds.flatMap(
    (definitionId) => {
      const chainableDefinition = catalog.definitions[definitionId];
      return chainableDefinition === undefined
        ? []
        : [chainableDefinition.name];
    },
  );
}
