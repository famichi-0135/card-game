import { z } from "zod";
import { deepFreeze } from "./deep-freeze.js";
import { validateGameRules } from "./validate-game-rules.js";
import type {
  AttackCardDefinition,
  CardCatalog,
  CardCatalogValidationError,
  CardCatalogValidationResult,
  CardDefinition,
  CreateCardCatalogResult,
  SupportCardDefinition,
} from "../contracts/card-definition.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type {
  CardEffectDefinition,
  EffectActivationType,
} from "../contracts/effect-definition.js";
import type { GameEngineContext } from "../contracts/engine.js";
import type { TargetRule } from "../contracts/effect-target.js";
import type { JsonValue } from "../contracts/json.js";

const safeInteger = z
  .number()
  .finite()
  .int()
  .refine(Number.isSafeInteger, "安全な整数でなければなりません。");
const nonNegativeSafeInteger = safeInteger.min(0);
const nonEmptyString = z.string().trim().min(1);
const factionSchema = z.enum(["disaster", "countermeasure"]);
const presentationSchema = z
  .object({
    rulesText: nonEmptyString,
    imageAssetId: z.string().trim().min(1).nullable(),
  })
  .strict();

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const targetRuleSchema = z
  .object({
    required: z.boolean(),
    minTargets: nonNegativeSafeInteger,
    maxTargets: nonNegativeSafeInteger,
    side: z.enum(["self", "opponent", "either"]),
    zones: z.array(
      z.enum(["attackCard", "attackGroup", "supportCard", "player", "mana"]),
    ),
    allowSourceCard: z.boolean(),
  })
  .strict();

const baseEffectFields = {
  effectId: nonEmptyString,
  activationType: z.enum(["onPlay", "continuous"]),
  targetRule: targetRuleSchema,
};

const cardEffectDefinitionSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...baseEffectFields,
      type: z.literal("modifyPower"),
      scope: z.enum(["cardPower", "groupPower", "totalPower"]),
      operation: z.enum(["overwrite", "add", "multiply"]),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("changeStamina"),
      amount: safeInteger,
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("reduceMana"),
      amount: nonNegativeSafeInteger,
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("drawCards"),
      count: nonNegativeSafeInteger,
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("removeAttackGroup"),
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("removeSupportCard"),
    })
    .strict(),
  z
    .object({
      ...baseEffectFields,
      type: z.literal("custom"),
      handlerId: nonEmptyString,
      config: z.record(z.string(), jsonValueSchema),
    })
    .strict(),
]);

const cardDefinitionSchema = z.discriminatedUnion("cardType", [
  z
    .object({
      id: nonEmptyString,
      name: nonEmptyString,
      faction: factionSchema,
      attribute: z.enum(["attributeA", "attributeB", "attributeC"]),
      cardType: z.literal("mana"),
      presentation: presentationSchema.optional(),
      manaAmount: z.literal(1),
    })
    .strict(),
  z
    .object({
      id: nonEmptyString,
      name: nonEmptyString,
      faction: factionSchema,
      attribute: z.enum(["attributeA", "attributeB", "attributeC"]),
      cardType: z.literal("attack"),
      presentation: presentationSchema.optional(),
      cost: nonNegativeSafeInteger,
      basePower: safeInteger.min(1),
      chainableCardIds: z.array(nonEmptyString),
      effects: z.array(cardEffectDefinitionSchema),
    })
    .strict(),
  z
    .object({
      id: nonEmptyString,
      name: nonEmptyString,
      faction: factionSchema,
      attribute: z.enum(["attributeA", "attributeB", "attributeC"]),
      cardType: z.literal("support"),
      presentation: presentationSchema.optional(),
      cost: nonNegativeSafeInteger,
      duration: z.enum(["instant", "untilRoundEnd", "permanent"]),
      effects: z.array(cardEffectDefinitionSchema).min(1),
    })
    .strict(),
]);

const cardCatalogInputSchema = z
  .object({
    version: nonEmptyString,
    definitions: z.array(cardDefinitionSchema).min(1),
  })
  .strict();

type CatalogValidationContext = Pick<
  GameEngineContext,
  "rules" | "effectRegistry" | "engineSemanticsVersion"
>;

export function createCardCatalog(
  input: unknown,
  context: CatalogValidationContext,
): CreateCardCatalogResult {
  const parsed = cardCatalogInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: "SCHEMA_VALIDATION_FAILED",
        message: issue.message,
        details: { path: issue.path.join(".") },
      })),
    };
  }

  const definitions: Record<string, CardDefinition> = Object.create(null);
  const duplicateErrors: CardCatalogValidationError[] = [];

  for (const definition of parsed.data.definitions as CardDefinition[]) {
    if (definition.id in definitions) {
      duplicateErrors.push({
        code: "DUPLICATE_CARD_ID",
        cardDefinitionId: definition.id,
        message: `カード定義ID ${definition.id} が重複しています。`,
      });
      continue;
    }
    definitions[definition.id] = definition;
  }

  if (duplicateErrors.length > 0) {
    return { valid: false, errors: duplicateErrors };
  }

  const catalog = deepFreeze({
    version: parsed.data.version,
    definitions,
  }) as CardCatalog;
  const result = validateCardCatalog(catalog, context);

  return result.valid ? { valid: true, catalog } : result;
}

export function validateCardCatalog(
  catalog: CardCatalog,
  context: CatalogValidationContext,
): CardCatalogValidationResult {
  const errors: CardCatalogValidationError[] = [];
  const rulesResult = validateGameRules(context.rules);

  if (
    catalog.version.trim().length === 0 ||
    context.engineSemanticsVersion.trim().length === 0
  ) {
    errors.push({
      code: "INVALID_CATALOG_VERSION",
      message:
        "カードカタログとエンジン意味論のバージョンは空文字列にできません。",
    });
  }

  if (!rulesResult.valid) {
    errors.push({
      code: "INVALID_NUMERIC_VALUE",
      message: "ゲームルールがカードカタログの検証条件を満たしていません。",
    });
  }

  const definitionIds = new Set<string>();
  for (const [recordKey, definition] of Object.entries(catalog.definitions)) {
    if (recordKey !== definition.id || definitionIds.has(definition.id)) {
      errors.push({
        code: "DUPLICATE_CARD_ID",
        cardDefinitionId: definition.id,
        message: `カード定義ID ${definition.id} が一意に登録されていません。`,
      });
    }
    definitionIds.add(definition.id);

    validateDefinition(definition, catalog, context, errors);
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

function validateDefinition(
  definition: DeepReadonly<CardDefinition>,
  catalog: CardCatalog,
  context: CatalogValidationContext,
  errors: CardCatalogValidationError[],
): void {
  if (definition.cardType === "attack") {
    if (definition.effects.length > 0) {
      errors.push({
        code: "INVALID_LIFECYCLE_COMBINATION",
        cardDefinitionId: definition.id,
        message:
          "初期カードカタログの攻撃カード効果は空配列でなければなりません。",
      });
    }

    for (const chainableCardId of definition.chainableCardIds) {
      const target = catalog.definitions[chainableCardId];
      if (target?.cardType !== "attack") {
        errors.push({
          code: "CARD_REFERENCE_NOT_FOUND",
          cardDefinitionId: definition.id,
          message: `連鎖先 ${chainableCardId} は存在する攻撃カードでなければなりません。`,
        });
      } else if (target.faction !== definition.faction) {
        errors.push({
          code: "CROSS_FACTION_CARD_REFERENCE",
          cardDefinitionId: definition.id,
          message: `連鎖先 ${chainableCardId} は同じ陣営の攻撃カードでなければなりません。`,
        });
      }
    }
  }

  if (definition.cardType === "support" && definition.effects.length === 0) {
    errors.push({
      code: "INVALID_LIFECYCLE_COMBINATION",
      cardDefinitionId: definition.id,
      message: "サポートカードは少なくとも1つの効果を持つ必要があります。",
    });
  }

  if (definition.cardType === "mana") {
    return;
  }

  const effectIds = new Set<string>();
  for (const effect of definition.effects) {
    if (effectIds.has(effect.effectId)) {
      errors.push({
        code: "DUPLICATE_EFFECT_ID",
        cardDefinitionId: definition.id,
        effectId: effect.effectId,
        message: `効果ID ${effect.effectId} が同じカード内で重複しています。`,
      });
    }
    effectIds.add(effect.effectId);

    validateEffectLifecycle(definition, effect, context, errors);
    validateEffectNumericValues(definition.id, effect, errors);
    validateEffectTargetRule(definition.id, effect, errors);
  }
}

function validateEffectLifecycle(
  definition: DeepReadonly<AttackCardDefinition | SupportCardDefinition>,
  effect: DeepReadonly<CardEffectDefinition>,
  context: CatalogValidationContext,
  errors: CardCatalogValidationError[],
): void {
  const expectedActivation: EffectActivationType | undefined =
    effect.type === "modifyPower"
      ? "continuous"
      : effect.type === "custom"
        ? undefined
        : "onPlay";

  const isInstantContinuous =
    definition.cardType === "support" &&
    definition.duration === "instant" &&
    effect.activationType === "continuous";

  if (
    isInstantContinuous ||
    (expectedActivation !== undefined &&
      effect.activationType !== expectedActivation)
  ) {
    errors.push({
      code: "INVALID_LIFECYCLE_COMBINATION",
      cardDefinitionId: definition.id,
      effectId: effect.effectId,
      message: `効果 ${effect.effectId} の発動形式は許可されていません。`,
    });
  }

  if (effect.type === "custom") {
    const handler = context.effectRegistry[effect.handlerId];
    if (handler === undefined) {
      errors.push({
        code: "HANDLER_NOT_FOUND",
        cardDefinitionId: definition.id,
        effectId: effect.effectId,
        message: `カスタム効果ハンドラー ${effect.handlerId} が見つかりません。`,
      });
      return;
    }

    const result = handler.validateDefinition(effect);
    if (!result.valid) {
      errors.push(
        ...result.errors.map((error) => ({
          code: "INVALID_LIFECYCLE_COMBINATION" as const,
          cardDefinitionId: definition.id,
          effectId: effect.effectId,
          message: error.message,
          details: error.details,
        })),
      );
    }
  }
}

function validateEffectTargetRule(
  cardDefinitionId: string,
  effect: DeepReadonly<CardEffectDefinition>,
  errors: CardCatalogValidationError[],
): void {
  const rule = effect.targetRule;
  const expectedZones = getExpectedZones(effect);

  if (!isValidTargetRule(rule, expectedZones)) {
    errors.push({
      code: "INVALID_TARGET_RULE",
      cardDefinitionId,
      effectId: effect.effectId,
      message: `効果 ${effect.effectId} の対象ルールが効果種別と一致しません。`,
    });
  }
}

function validateEffectNumericValues(
  cardDefinitionId: string,
  effect: DeepReadonly<CardEffectDefinition>,
  errors: CardCatalogValidationError[],
): void {
  if (effect.type !== "modifyPower") {
    return;
  }

  const isValidValue =
    effect.operation === "multiply"
      ? Number.isFinite(effect.value) && effect.value >= 0
      : Number.isSafeInteger(effect.value);

  if (!isValidValue) {
    errors.push({
      code: "INVALID_NUMERIC_VALUE",
      cardDefinitionId,
      effectId: effect.effectId,
      message:
        effect.operation === "multiply"
          ? "攻撃力乗算値は0以上の有限数でなければなりません。"
          : "攻撃力の加算値と上書き値は安全な整数でなければなりません。",
    });
  }
}

function getExpectedZones(
  effect: DeepReadonly<CardEffectDefinition>,
): readonly string[] | undefined {
  switch (effect.type) {
    case "modifyPower":
      return [
        effect.scope === "cardPower"
          ? "attackCard"
          : effect.scope === "groupPower"
            ? "attackGroup"
            : "player",
      ];
    case "changeStamina":
      return ["player"];
    case "reduceMana":
      return ["mana"];
    case "drawCards":
      return [];
    case "removeAttackGroup":
      return ["attackGroup"];
    case "removeSupportCard":
      return ["supportCard"];
    case "custom":
      return undefined;
  }
}

function isValidTargetRule(
  rule: DeepReadonly<TargetRule>,
  expectedZones: readonly string[] | undefined,
): boolean {
  if (
    !Number.isSafeInteger(rule.minTargets) ||
    !Number.isSafeInteger(rule.maxTargets)
  ) {
    return false;
  }
  if (rule.minTargets < 0 || rule.maxTargets < rule.minTargets) {
    return false;
  }
  if (
    (rule.required && rule.minTargets < 1) ||
    (!rule.required && rule.minTargets !== 0)
  ) {
    return false;
  }
  if ((rule.maxTargets === 0) !== (rule.zones.length === 0)) {
    return false;
  }
  if (
    rule.allowSourceCard &&
    !rule.zones.some((zone) => zone === "attackCard" || zone === "supportCard")
  ) {
    return false;
  }
  if (expectedZones === undefined) {
    return true;
  }
  return (
    rule.zones.length === expectedZones.length &&
    rule.zones.every((zone) => expectedZones.includes(zone))
  );
}
