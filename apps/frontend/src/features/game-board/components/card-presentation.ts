import type {
  Attribute,
  Faction,
  PublicCardCatalog,
} from "@disastar/game-engine";

const attributeLabels: Record<Faction, Record<Attribute, string>> = {
  disaster: {
    attributeA: "大地",
    attributeB: "水",
    attributeC: "空",
  },
  countermeasure: {
    attributeA: "備える力",
    attributeB: "守る力",
    attributeC: "つながる力",
  },
};

export function getAttributeLabel(
  faction: Faction,
  attribute: Attribute,
): string {
  return attributeLabels[faction][attribute];
}

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
