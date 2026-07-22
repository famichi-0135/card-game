import type {
  CardCatalog,
  CardDefinition,
  CardEffectDefinition,
  DeepReadonly,
  PublicCardCatalog,
  PublicCardDefinition,
} from "../contracts/index.js";

/**
 * カードカタログを、効果ハンドラーや内部設定を含まない表示専用 DTO に変換する。
 */
export function projectPublicCardCatalog(
  catalog: CardCatalog,
): PublicCardCatalog {
  return {
    version: catalog.version,
    definitions: Object.fromEntries(
      Object.entries(catalog.definitions).map(([definitionId, definition]) => [
        definitionId,
        projectPublicCardDefinition(definition),
      ]),
    ),
  };
}

function projectPublicCardDefinition(
  definition: DeepReadonly<CardDefinition>,
): PublicCardDefinition {
  const base = {
    id: definition.id,
    name: definition.name,
    faction: definition.faction,
    attribute: definition.attribute,
    cardType: definition.cardType,
    rulesText:
      definition.presentation?.rulesText ?? createRulesText(definition),
    imageAssetId: definition.presentation?.imageAssetId ?? null,
  } as const;

  switch (definition.cardType) {
    case "mana":
      return {
        ...base,
        manaAmount: definition.manaAmount,
        interaction: emptyInteraction(),
      };
    case "attack":
      return {
        ...base,
        cost: definition.cost,
        basePower: definition.basePower,
        interaction: {
          chainableCardDefinitionIds: [...definition.chainableCardIds],
          effects: definition.effects.map(projectEffectInteraction),
        },
      };
    case "support":
      return {
        ...base,
        cost: definition.cost,
        duration: definition.duration,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: definition.effects.map(projectEffectInteraction),
        },
      };
  }
}

function emptyInteraction() {
  return { chainableCardDefinitionIds: [], effects: [] };
}

function projectEffectInteraction(effect: DeepReadonly<CardEffectDefinition>) {
  return {
    effectId: effect.effectId,
    activationType: effect.activationType,
    target: {
      required: effect.targetRule.required,
      minTargets: effect.targetRule.minTargets,
      maxTargets: effect.targetRule.maxTargets,
      side: effect.targetRule.side,
      zones: [...effect.targetRule.zones],
      allowSourceCard: effect.targetRule.allowSourceCard,
      selectionOrder: "independent" as const,
    },
  };
}

function createRulesText(definition: DeepReadonly<CardDefinition>): string {
  switch (definition.cardType) {
    case "mana":
      return "ゲーム開始時にみなもととして配置されるカードです。";
    case "attack":
      return `必要なみなもと ${definition.cost}。基本攻撃力 ${definition.basePower}。`;
    case "support":
      return `${createDurationText(definition.duration)}。${definition.effects
        .map(describeEffect)
        .join(" ")}`;
  }
}

function createDurationText(
  duration: "instant" | "untilRoundEnd" | "permanent",
): string {
  switch (duration) {
    case "instant":
      return "使用後すぐに解決されます";
    case "untilRoundEnd":
      return "ラウンド終了まで効果が続きます";
    case "permanent":
      return "場にある間、効果が続きます";
  }
}

function describeEffect(effect: DeepReadonly<CardEffectDefinition>): string {
  switch (effect.type) {
    case "modifyPower":
      return "攻撃力を変更します。";
    case "changeStamina":
      return "スタミナを変更します。";
    case "reduceMana":
      return "みなもとを減らします。";
    case "drawCards":
      return "カードを引きます。";
    case "removeAttackGroup":
      return "攻撃グループを除去します。";
    case "removeSupportCard":
      return "サポートカードを除去します。";
    case "custom":
      return "固有の効果を解決します。";
  }
}
