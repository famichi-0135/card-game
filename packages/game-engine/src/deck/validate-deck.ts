import type {
  CardCatalog,
  CardDefinition,
  Faction,
} from "../contracts/card-definition.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type { CardDefinitionId } from "../contracts/identifiers.js";
import type {
  DeckValidationError,
  DeckValidationResult,
} from "../contracts/commands.js";
import type { GameRules } from "../contracts/rules.js";

export function validateDeck(
  deckDefinitionIds: readonly CardDefinitionId[],
  expectedFaction: Faction,
  cardCatalog: CardCatalog,
  rules: Readonly<GameRules>,
): DeckValidationResult {
  const errors: DeckValidationError[] = [];

  if (deckDefinitionIds.length !== rules.deckSize) {
    errors.push({
      code: "INVALID_DECK_SIZE",
      message: `デッキは${rules.deckSize}枚でなければなりません。`,
    });
  }

  const definitions: DeepReadonly<CardDefinition>[] = [];
  for (const definitionId of deckDefinitionIds) {
    const definition = cardCatalog.definitions[definitionId];
    if (definition === undefined) {
      errors.push({
        code: "CARD_DEFINITION_NOT_FOUND",
        cardDefinitionId: definitionId,
        message: `カード定義 ${definitionId} が見つかりません。`,
      });
      continue;
    }

    if (!isUsableCardDefinition(definition)) {
      errors.push({
        code: "CARD_DEFINITION_INVALID",
        cardDefinitionId: definitionId,
        message: `カード定義 ${definitionId} の数値または種別が不正です。`,
      });
      continue;
    }

    if (definition.faction !== expectedFaction) {
      errors.push({
        code: "FACTION_MISMATCH",
        cardDefinitionId: definitionId,
        message: `カード定義 ${definitionId} は${expectedFaction}陣営のカードではありません。`,
      });
      continue;
    }

    definitions.push(definition);
  }

  const manaCards = definitions.filter(
    (definition) => definition.cardType === "mana",
  );
  const attackCards = definitions.filter(
    (definition) => definition.cardType === "attack",
  );
  const supportCards = definitions.filter(
    (definition) => definition.cardType === "support",
  );

  if (
    manaCards.length < rules.minManaCards ||
    manaCards.length > rules.maxManaCards
  ) {
    errors.push({
      code: "INVALID_CARD_TYPE_COUNT",
      message: `みなもとカードは${rules.minManaCards}枚以上${rules.maxManaCards}枚以下でなければなりません。`,
    });
  }

  if (attackCards.length < rules.minAttackCards) {
    errors.push({
      code: "INVALID_CARD_TYPE_COUNT",
      message: `攻撃カードは${rules.minAttackCards}枚以上必要です。`,
    });
  }

  if (supportCards.length > rules.maxSupportCards) {
    errors.push({
      code: "INVALID_CARD_TYPE_COUNT",
      message: `サポートカードは${rules.maxSupportCards}枚以下でなければなりません。`,
    });
  }

  validateSameNameLimit(
    attackCards,
    rules.maxSameNamedAttackCards,
    "攻撃カード",
    errors,
  );
  validateSameNameLimit(
    supportCards,
    rules.maxSameNamedSupportCards,
    "サポートカード",
    errors,
  );

  for (const attribute of ["attributeA", "attributeB", "attributeC"] as const) {
    const hasMana = manaCards.some(
      (definition) => definition.attribute === attribute,
    );
    const hasPlayableCard = [...attackCards, ...supportCards].some(
      (definition) => definition.attribute === attribute,
    );

    if (!hasMana || !hasPlayableCard) {
      errors.push({
        code: "ATTRIBUTE_REQUIREMENT_NOT_MET",
        message: `${attribute}にはみなもとカードと攻撃またはサポートカードが必要です。`,
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function validateSameNameLimit(
  definitions: readonly DeepReadonly<CardDefinition>[],
  limit: number,
  cardTypeLabel: string,
  errors: DeckValidationError[],
): void {
  const countByName = new Map<string, number>();

  for (const definition of definitions) {
    const count = (countByName.get(definition.name) ?? 0) + 1;
    countByName.set(definition.name, count);
    if (count > limit) {
      errors.push({
        code: "SAME_NAME_LIMIT_EXCEEDED",
        cardDefinitionId: definition.id,
        message: `${cardTypeLabel} ${definition.name} は${limit}枚までです。`,
      });
    }
  }
}

function isUsableCardDefinition(
  definition: DeepReadonly<CardDefinition>,
): boolean {
  if (definition.cardType === "mana") {
    return definition.manaAmount === 1;
  }
  if (!isNonNegativeSafeInteger(definition.cost)) {
    return false;
  }
  return (
    definition.cardType !== "attack" ||
    (isNonNegativeSafeInteger(definition.basePower) &&
      definition.basePower >= 1)
  );
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
