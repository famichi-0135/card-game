import type { SupportCardDefinition } from "../contracts/card-definition.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type {
  CardEffectDefinition,
  ChangeStaminaEffectDefinition,
  DrawCardsEffectDefinition,
  ModifyPowerEffectDefinition,
  ReduceManaEffectDefinition,
  RemoveAttackGroupEffectDefinition,
  RemoveSupportCardEffectDefinition,
} from "../contracts/effect-definition.js";
import type { EffectTarget, TargetRule } from "../contracts/effect-target.js";
import type {
  ActiveEffectDraft,
  EffectContext,
  EffectInput,
  EffectPlanOperation,
  EffectRegistry,
  EffectResolutionPlan,
  EffectValidationError,
} from "../contracts/effects.js";
import type { GameState } from "../contracts/game-state.js";
import type { EffectId, PlayerId } from "../contracts/identifiers.js";

export type EffectInputValidationResult =
  | {
      valid: true;
      inputsByEffectId: ReadonlyMap<EffectId, DeepReadonly<EffectInput>>;
    }
  | {
      valid: false;
      error: EffectValidationError;
    };

export type EffectPlanningResult =
  | { planned: true; plan: EffectResolutionPlan }
  | { planned: false; error: EffectValidationError };

export function validateEffectInputs(
  effects: readonly DeepReadonly<CardEffectDefinition>[],
  inputs: readonly EffectInput[],
): EffectInputValidationResult {
  const expectedEffectIds = new Set(effects.map((effect) => effect.effectId));
  const inputsByEffectId = new Map<EffectId, DeepReadonly<EffectInput>>();

  for (const input of inputs) {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof input.effectId !== "string" ||
      !Array.isArray(input.targets)
    ) {
      return invalidInput("効果入力の構造が不正です。");
    }
    if (!expectedEffectIds.has(input.effectId)) {
      return invalidInput(`未知の効果ID ${input.effectId} が指定されました。`);
    }
    if (inputsByEffectId.has(input.effectId)) {
      return invalidInput(`効果ID ${input.effectId} が重複しています。`);
    }
    inputsByEffectId.set(input.effectId, input);
  }

  for (const effect of effects) {
    if (!inputsByEffectId.has(effect.effectId)) {
      return invalidInput(`効果ID ${effect.effectId} の入力がありません。`);
    }
  }

  return { valid: true, inputsByEffectId };
}

export function planCardEffect(
  context: EffectContext,
  definition: DeepReadonly<CardEffectDefinition>,
  effectRegistry: Readonly<EffectRegistry>,
): EffectPlanningResult {
  const sourceValidation = validateSourceCard(context);
  if (sourceValidation !== null) {
    return { planned: false, error: sourceValidation };
  }
  const targetValidation = validateTargets(context, definition.targetRule);
  if (targetValidation !== null) {
    return { planned: false, error: targetValidation };
  }

  try {
    switch (definition.type) {
      case "modifyPower":
        return planModifyPower(context, definition);
      case "changeStamina":
        return planChangeStamina(context, definition);
      case "reduceMana":
        return planReduceMana(context, definition);
      case "drawCards":
        return planDrawCards(context, definition);
      case "removeAttackGroup":
        return planRemoveAttackGroup(context, definition);
      case "removeSupportCard":
        return planRemoveSupportCard(context, definition);
      case "custom": {
        const customHandler = effectRegistry[definition.handlerId];
        if (customHandler === undefined) {
          return {
            planned: false,
            error: effectError(
              "EFFECT_HANDLER_NOT_FOUND",
              `カスタム効果ハンドラー ${definition.handlerId} が見つかりません。`,
            ),
          };
        }
        const validation = customHandler.validate(context, definition);
        if (!validation.valid) {
          return {
            planned: false,
            error:
              validation.errors[0] ??
              effectError(
                "EFFECT_PLANNING_FAILED",
                "カスタム効果の検証に失敗しました。",
              ),
          };
        }
        return { planned: true, plan: customHandler.plan(context, definition) };
      }
      default:
        return {
          planned: false,
          error: effectError(
            "EFFECT_HANDLER_NOT_FOUND",
            "未対応の効果種別です。",
          ),
        };
    }
  } catch (error) {
    return {
      planned: false,
      error: effectError(
        "EFFECT_PLANNING_FAILED",
        error instanceof Error
          ? error.message
          : "効果計画の作成中にエラーが発生しました。",
      ),
    };
  }
}

function planChangeStamina(
  context: EffectContext,
  definition: DeepReadonly<ChangeStaminaEffectDefinition>,
): EffectPlanningResult {
  const activationError = requireOnPlay(definition);
  if (activationError !== null) {
    return { planned: false, error: activationError };
  }
  if (!Number.isSafeInteger(definition.amount)) {
    return {
      planned: false,
      error: effectError(
        "EFFECT_CONFIG_INVALID",
        "スタミナ変更量は安全な整数でなければなりません。",
      ),
    };
  }

  const operations: EffectPlanOperation[] = [];
  for (const target of context.input.targets) {
    if (target.type !== "player") {
      return {
        planned: false,
        error: effectError(
          "INVALID_TARGET_TYPE",
          "スタミナ変更の対象はプレイヤーでなければなりません。",
        ),
      };
    }
    operations.push({
      type: "CHANGE_STAMINA",
      playerId: target.playerId,
      amount: definition.amount,
    });
  }
  return { planned: true, plan: { operations } };
}

function planReduceMana(
  context: EffectContext,
  definition: DeepReadonly<ReduceManaEffectDefinition>,
): EffectPlanningResult {
  const activationError = requireOnPlay(definition);
  if (activationError !== null) {
    return { planned: false, error: activationError };
  }
  if (!Number.isSafeInteger(definition.amount) || definition.amount < 0) {
    return {
      planned: false,
      error: effectError(
        "EFFECT_CONFIG_INVALID",
        "みなもと減少量は0以上の安全な整数でなければなりません。",
      ),
    };
  }

  const operations: EffectPlanOperation[] = [];
  for (const target of context.input.targets) {
    if (target.type !== "mana") {
      return {
        planned: false,
        error: effectError(
          "INVALID_TARGET_TYPE",
          "みなもと減少の対象はみなもとでなければなりません。",
        ),
      };
    }
    operations.push({
      type: "REDUCE_MANA",
      playerId: target.playerId,
      attribute: target.attribute,
      requestedAmount: definition.amount,
    });
  }
  return { planned: true, plan: { operations } };
}

function planDrawCards(
  context: EffectContext,
  definition: DeepReadonly<DrawCardsEffectDefinition>,
): EffectPlanningResult {
  const activationError = requireOnPlay(definition);
  if (activationError !== null) {
    return { planned: false, error: activationError };
  }
  if (!Number.isSafeInteger(definition.count) || definition.count < 0) {
    return {
      planned: false,
      error: effectError(
        "EFFECT_CONFIG_INVALID",
        "ドロー枚数は0以上の安全な整数でなければなりません。",
      ),
    };
  }
  if (context.input.targets.length !== 0) {
    return {
      planned: false,
      error: effectError(
        "INVALID_TARGET_COUNT",
        "カードドローは対象を指定できません。",
      ),
    };
  }
  return {
    planned: true,
    plan: {
      operations: [
        {
          type: "DRAW_CARDS",
          playerId: context.ownerId,
          count: definition.count,
        },
      ],
    },
  };
}

function planRemoveAttackGroup(
  context: EffectContext,
  definition: DeepReadonly<RemoveAttackGroupEffectDefinition>,
): EffectPlanningResult {
  const activationError = requireOnPlay(definition);
  if (activationError !== null) {
    return { planned: false, error: activationError };
  }
  const operations: EffectPlanOperation[] = [];
  for (const target of context.input.targets) {
    if (target.type !== "attackGroup") {
      return {
        planned: false,
        error: effectError(
          "INVALID_TARGET_TYPE",
          "攻撃グループ除去の対象は攻撃グループでなければなりません。",
        ),
      };
    }
    operations.push({ type: "REMOVE_ATTACK_GROUP", groupId: target.groupId });
  }
  return { planned: true, plan: { operations } };
}

function planRemoveSupportCard(
  context: EffectContext,
  definition: DeepReadonly<RemoveSupportCardEffectDefinition>,
): EffectPlanningResult {
  const activationError = requireOnPlay(definition);
  if (activationError !== null) {
    return { planned: false, error: activationError };
  }
  const operations: EffectPlanOperation[] = [];
  for (const target of context.input.targets) {
    if (target.type !== "supportCard") {
      return {
        planned: false,
        error: effectError(
          "INVALID_TARGET_TYPE",
          "サポートカード除去の対象はサポートカードでなければなりません。",
        ),
      };
    }
    operations.push({
      type: "REMOVE_SUPPORT_CARD",
      cardInstanceId: target.cardInstanceId,
    });
  }
  return { planned: true, plan: { operations } };
}

function requireOnPlay(
  definition: DeepReadonly<CardEffectDefinition>,
): EffectValidationError | null {
  return definition.activationType === "onPlay"
    ? null
    : effectError(
        "INVALID_ACTIVATION_TYPE",
        `${definition.type}はonPlay効果としてのみ実行できます。`,
      );
}

function planModifyPower(
  context: EffectContext,
  definition: DeepReadonly<ModifyPowerEffectDefinition>,
): EffectPlanningResult {
  if (definition.activationType !== "continuous") {
    return {
      planned: false,
      error: effectError(
        "INVALID_ACTIVATION_TYPE",
        "modifyPowerはcontinuous効果としてのみ実行できます。",
      ),
    };
  }
  const source = getSupportSourceDefinition(context);
  if (source === undefined || source.duration === "instant") {
    return {
      planned: false,
      error: effectError(
        "EFFECT_CONFIG_INVALID",
        "継続的な攻撃力変更には場に残るサポートカードが必要です。",
      ),
    };
  }

  const expectedTargetType = getExpectedTargetType(definition.scope);
  if (
    context.input.targets.some((target) => target.type !== expectedTargetType)
  ) {
    return {
      planned: false,
      error: effectError(
        "INVALID_TARGET_TYPE",
        "攻撃力変更の対象種別がscopeと一致しません。",
      ),
    };
  }

  const duration =
    source.duration === "untilRoundEnd"
      ? "untilRoundEnd"
      : "whileSourceOnField";
  const operations = context.input.targets.map((target) => ({
    type: "ADD_ACTIVE_EFFECT" as const,
    effect: {
      effectId: definition.effectId,
      sourceCardInstanceId: context.sourceCardInstanceId,
      ownerId: context.ownerId,
      target,
      scope: definition.scope,
      operation: definition.operation,
      value: definition.value,
      duration,
    } satisfies ActiveEffectDraft,
  }));

  return { planned: true, plan: { operations } };
}

function validateSourceCard(
  context: EffectContext,
): EffectValidationError | null {
  const instance = context.state.cardInstances[context.sourceCardInstanceId];
  if (instance === undefined) {
    return effectError(
      "SOURCE_CARD_NOT_FOUND",
      "効果元カードが見つかりません。",
    );
  }
  if (
    instance.ownerId !== context.ownerId ||
    instance.definitionId !== context.sourceCardDefinitionId
  ) {
    return effectError(
      "SOURCE_CARD_NOT_ON_EXPECTED_ZONE",
      "効果元カードの所有者または定義が不正です。",
    );
  }
  const owner = context.state.players[context.ownerId];
  if (
    owner === undefined ||
    !owner.battlefield.supportZone.some(
      (card) => card.cardInstanceId === context.sourceCardInstanceId,
    )
  ) {
    return effectError(
      "SOURCE_CARD_NOT_ON_EXPECTED_ZONE",
      "効果元カードはサポートゾーンに存在する必要があります。",
    );
  }
  return null;
}

function validateTargets(
  context: EffectContext,
  rule: DeepReadonly<TargetRule>,
): EffectValidationError | null {
  const targets = context.input.targets;
  if (targets.length < rule.minTargets || targets.length > rule.maxTargets) {
    return effectError(
      "INVALID_TARGET_COUNT",
      "効果対象数が条件と一致しません。",
    );
  }
  if (rule.required && targets.length === 0) {
    return effectError(
      "INVALID_TARGET_COUNT",
      "この効果には対象指定が必要です。",
    );
  }

  const targetKeys = new Set<string>();
  for (const target of targets) {
    if (!isEffectTarget(target)) {
      return effectError("INVALID_TARGET_TYPE", "効果対象の構造が不正です。");
    }
    if (!rule.zones.includes(target.type)) {
      return effectError(
        "INVALID_TARGET_TYPE",
        "対象種別はこの効果では選択できません。",
      );
    }
    const targetKey = JSON.stringify(target);
    if (targetKeys.has(targetKey)) {
      return effectError(
        "INVALID_TARGET_COUNT",
        "同じ対象は重複して指定できません。",
      );
    }
    targetKeys.add(targetKey);

    const ownerId = findTargetOwnerId(context.state, target);
    if (ownerId === undefined) {
      return effectError(
        "TARGET_NOT_FOUND",
        "指定された効果対象が見つかりません。",
      );
    }
    if (!isAllowedSide(rule.side, context.ownerId, ownerId)) {
      return effectError(
        "INVALID_TARGET_OWNER",
        "効果対象の所有者が条件と一致しません。",
      );
    }
    if (!rule.allowSourceCard && isSourceCardTarget(context, target)) {
      return effectError(
        "INVALID_TARGET_TYPE",
        "効果元カード自身は対象にできません。",
      );
    }
  }
  return null;
}

function getSupportSourceDefinition(
  context: EffectContext,
): DeepReadonly<SupportCardDefinition> | undefined {
  const definition =
    context.cardCatalog.definitions[context.sourceCardDefinitionId];
  return definition?.cardType === "support" ? definition : undefined;
}

function getExpectedTargetType(
  scope: ModifyPowerEffectDefinition["scope"],
): EffectTarget["type"] {
  switch (scope) {
    case "cardPower":
      return "attackCard";
    case "groupPower":
      return "attackGroup";
    case "totalPower":
      return "player";
  }
}

function findTargetOwnerId(
  state: DeepReadonly<GameState>,
  target: DeepReadonly<EffectTarget>,
): PlayerId | undefined {
  switch (target.type) {
    case "player":
    case "mana":
      return state.players[target.playerId]?.playerId;
    case "attackGroup":
      return Object.values(state.players).find((player) =>
        player.battlefield.attackGroups.some(
          (group) => group.groupId === target.groupId,
        ),
      )?.playerId;
    case "attackCard":
      return Object.values(state.players).find((player) =>
        player.battlefield.attackGroups.some((group) =>
          group.cardIds.includes(target.cardInstanceId),
        ),
      )?.playerId;
    case "supportCard":
      return Object.values(state.players).find((player) =>
        player.battlefield.supportZone.some(
          (card) => card.cardInstanceId === target.cardInstanceId,
        ),
      )?.playerId;
  }
}

function isEffectTarget(value: unknown): value is DeepReadonly<EffectTarget> {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  switch (value.type) {
    case "attackCard":
    case "supportCard":
      return (
        "cardInstanceId" in value && typeof value.cardInstanceId === "string"
      );
    case "attackGroup":
      return "groupId" in value && typeof value.groupId === "string";
    case "player":
      return "playerId" in value && typeof value.playerId === "string";
    case "mana":
      return (
        "playerId" in value &&
        typeof value.playerId === "string" &&
        "attribute" in value &&
        ["attributeA", "attributeB", "attributeC"].includes(
          value.attribute as string,
        )
      );
    default:
      return false;
  }
}

function isAllowedSide(
  side: TargetRule["side"],
  ownerId: PlayerId,
  targetOwnerId: PlayerId,
): boolean {
  return (
    side === "either" ||
    (side === "self" && targetOwnerId === ownerId) ||
    (side === "opponent" && targetOwnerId !== ownerId)
  );
}

function isSourceCardTarget(
  context: EffectContext,
  target: DeepReadonly<EffectTarget>,
): boolean {
  return (
    (target.type === "attackCard" || target.type === "supportCard") &&
    target.cardInstanceId === context.sourceCardInstanceId
  );
}

function invalidInput(message: string): EffectInputValidationResult {
  return {
    valid: false,
    error: effectError("INVALID_EFFECT_INPUT", message),
  };
}

function effectError(
  code: EffectValidationError["code"],
  message: string,
): EffectValidationError {
  return { code, message };
}
