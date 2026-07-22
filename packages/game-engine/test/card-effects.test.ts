import { describe, expect, it } from "vitest";
import {
  calculateGroupPower,
  createCardCatalog,
  executeCommand,
  initializeGame,
  validateGameState,
} from "../src/index.js";
import type {
  CardCatalogInput,
  CardEffectHandler,
  EffectInput,
  GameCommand,
  GameEngineContext,
  GameState,
  PlayerId,
  SupportCardDefinition,
} from "../src/contracts/index.js";
import {
  createDependencies,
  createInitializationInput,
  createSequenceRandomGenerator,
  createTestCardCatalogInput,
  createTestContext,
  createValidDeckDefinitionIds,
} from "./fixtures.js";

describe("サポートカード効果", () => {
  it("対象グループへ継続的な攻撃力変更を原子的に適用する", () => {
    const context = createEffectContext();
    const state = prepareSupportPhase(context);
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-group-boost",
    );
    const groupId = getPlayer(state, playerId).battlefield.attackGroups[0]
      ?.groupId;
    if (groupId === undefined) {
      throw new Error("対象の攻撃グループがありません。");
    }
    const powerBefore = calculateGroupPower(state, groupId, context);

    const result = executeGameCommand(
      state,
      playerId,
      {
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: supportCardInstanceId,
        effectInputs: [
          {
            effectId: "group-boost",
            targets: [{ type: "attackGroup", groupId }],
          },
        ],
      },
      "play-group-boost",
      context,
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      throw new Error(result.error.message);
    }
    expect(calculateGroupPower(result.state, groupId, context)).toBe(
      powerBefore + 3,
    );
    expect(getPlayer(result.state, playerId).hand).not.toContain(
      supportCardInstanceId,
    );
    expect(getPlayer(result.state, playerId).battlefield.supportZone).toEqual([
      expect.objectContaining({
        cardInstanceId: supportCardInstanceId,
        duration: "untilRoundEnd",
      }),
    ]);
    expect(result.state.activeEffects).toEqual([
      expect.objectContaining({
        effectId: "group-boost",
        sourceCardInstanceId: supportCardInstanceId,
        target: { type: "attackGroup", groupId },
        scope: "groupPower",
        operation: "add",
        value: 3,
        duration: "untilRoundEnd",
      }),
    ]);
    expect(result.events.map((entry) => entry.event.type)).toEqual([
      "SUPPORT_CARD_PLAYED",
      "CARD_EFFECT_ACTIVATED",
      "ACTIVE_EFFECT_ADDED",
      "CARD_EFFECT_RESOLVED",
    ]);

    const firstFinished = requireAccepted(
      executeGameCommand(
        result.state,
        playerId,
        { type: "FINISH_SUPPORT" },
        "finish-support-after-boost",
        context,
      ),
    );
    const resolved = requireAccepted(
      executeGameCommand(
        firstFinished.state,
        firstFinished.state.secondPlayerId,
        { type: "FINISH_SUPPORT" },
        "finish-other-support-after-boost",
        context,
      ),
    );
    expect(resolved.state.activeEffects).toEqual([]);
    expect(getPlayer(resolved.state, playerId).battlefield.supportZone).toEqual(
      [],
    );
    expect(getPlayer(resolved.state, playerId).discardPile).toContain(
      supportCardInstanceId,
    );
    expect(resolved.events.map((entry) => entry.event.type)).toContain(
      "ACTIVE_EFFECT_REMOVED",
    );
    expect(resolved.events.map((entry) => entry.event.type)).toContain(
      "SUPPORT_CARD_REMOVED",
    );
  });

  it("無効な効果対象ではサポートカードの移動も効果登録も確定しない", () => {
    const context = createEffectContext();
    const state = prepareSupportPhase(context);
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-group-boost",
    );

    const result = executeGameCommand(
      state,
      playerId,
      {
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: supportCardInstanceId,
        effectInputs: [
          {
            effectId: "group-boost",
            targets: [{ type: "attackGroup", groupId: "missing-group" }],
          },
        ],
      },
      "play-invalid-target",
      context,
    );

    expect(result).toMatchObject({
      accepted: false,
      error: { code: "EFFECT_VALIDATION_FAILED" },
    });
    expect(result.state).toBe(state);
    expect(getPlayer(state, playerId).hand).toContain(supportCardInstanceId);
    expect(getPlayer(state, playerId).battlefield.supportZone).toEqual([]);
    expect(state.activeEffects).toEqual([]);
  });

  it("ハンドラーが返した不正な計画を拒否し、部分的な変更を残さない", () => {
    const context = createInvalidPlanContext();
    const state = prepareSupportPhase(context, "support-invalid-plan");
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-invalid-plan",
    );
    const groupId = getPlayer(state, playerId).battlefield.attackGroups[0]
      ?.groupId;
    if (groupId === undefined) {
      throw new Error("対象の攻撃グループがありません。");
    }

    const result = executeGameCommand(
      state,
      playerId,
      {
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: supportCardInstanceId,
        effectInputs: [
          {
            effectId: "invalid-plan",
            targets: [{ type: "attackGroup", groupId }],
          },
        ],
      },
      "play-invalid-plan",
      context,
    );

    expect(result).toMatchObject({
      accepted: false,
      error: { code: "EFFECT_VALIDATION_FAILED" },
    });
    expect(result.state).toBe(state);
    expect(getPlayer(state, playerId).hand).toContain(supportCardInstanceId);
    expect(getPlayer(state, playerId).battlefield.supportZone).toEqual([]);
    expect(state.activeEffects).toEqual([]);
  });

  it("存在しない対象を参照する継続効果を状態不変条件違反として検出する", () => {
    const context = createEffectContext();
    const state = prepareSupportPhase(context);
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-group-boost",
    );
    const groupId = getPlayer(state, playerId).battlefield.attackGroups[0]
      ?.groupId;
    if (groupId === undefined) {
      throw new Error("対象の攻撃グループがありません。");
    }
    const played = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "group-boost",
              targets: [{ type: "attackGroup", groupId }],
            },
          ],
        },
        "play-for-invariant-test",
        context,
      ),
    );
    const activeEffect = played.state.activeEffects[0];
    if (activeEffect === undefined) {
      throw new Error("継続効果が登録されませんでした。");
    }
    activeEffect.target = { type: "attackGroup", groupId: "missing-group" };

    expect(validateGameState(played.state, context)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "ACTIVE_EFFECT_TARGET_NOT_FOUND" }),
      ]),
    });
  });

  it("次の継続効果シーケンスは登録済み効果より後でなければならない", () => {
    const context = createEffectContext();
    const state = prepareSupportPhase(context);
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-group-boost",
    );
    const groupId = getPlayer(state, playerId).battlefield.attackGroups[0]
      ?.groupId;
    if (groupId === undefined) {
      throw new Error("対象の攻撃グループがありません。");
    }
    const played = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "group-boost",
              targets: [{ type: "attackGroup", groupId }],
            },
          ],
        },
        "play-for-sequence-test",
        context,
      ),
    );
    played.state.nextEffectSequence = 1;

    expect(validateGameState(played.state, context)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_ACTIVE_EFFECT_SEQUENCE" }),
      ]),
    });
  });
});

describe("即時効果", () => {
  it("プロパティ順が異なる同一対象を重複指定として拒否する", () => {
    const context = createContextWithSupport({
      id: "support-duplicate-target",
      name: "重複対象テスト",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "duplicate-mana-target",
          type: "reduceMana",
          activationType: "onPlay",
          amount: 1,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 2,
            side: "self",
            zones: ["mana"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-duplicate-target");
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-duplicate-target",
    );
    const result = executeGameCommand(
      state,
      playerId,
      {
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: supportCardInstanceId,
        effectInputs: [
          {
            effectId: "duplicate-mana-target",
            targets: [
              {
                type: "mana",
                playerId,
                attribute: "attributeA",
              },
              {
                attribute: "attributeA",
                playerId,
                type: "mana",
              },
            ],
          },
        ],
      },
      "play-duplicate-target",
      context,
    );

    expect(result).toMatchObject({
      accepted: false,
      error: { code: "EFFECT_VALIDATION_FAILED" },
    });
    expect(result.state).toBe(state);
  });

  it("instantカードの解決中は使用コストを予約する", () => {
    const context = createContextWithSupport({
      id: "support-self-mana-drain",
      name: "自己みなもと減少",
      attribute: "attributeA",
      cardType: "support",
      cost: 2,
      duration: "instant",
      effects: [
        {
          effectId: "drain-own-mana",
          type: "reduceMana",
          activationType: "onPlay",
          amount: 1,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "self",
            zones: ["mana"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-self-mana-drain");
    const playerId = state.firstPlayerId;
    getPlayer(state, playerId).mana.attributeA.total = 2;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-self-mana-drain",
    );

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "drain-own-mana",
              targets: [
                {
                  type: "mana",
                  playerId,
                  attribute: "attributeA",
                },
              ],
            },
          ],
        },
        "play-self-mana-drain",
        context,
      ),
    );

    expect(getPlayer(result.state, playerId).mana.attributeA.total).toBe(2);
    expect(getPlayer(result.state, playerId).discardPile).toContain(
      supportCardInstanceId,
    );
  });

  it("スタミナ変更を効果計画から適用し、instantカードを捨て札へ移動する", () => {
    const context = createContextWithSupport({
      id: "support-stamina-strike",
      name: "スタミナ打撃",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "damage-opponent",
          type: "changeStamina",
          activationType: "onPlay",
          amount: -2,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["player"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-stamina-strike");
    const playerId = state.firstPlayerId;
    const opponentId = state.secondPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-stamina-strike",
    );
    const staminaBefore = getPlayer(state, opponentId).stamina;

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "damage-opponent",
              targets: [{ type: "player", playerId: opponentId }],
            },
          ],
        },
        "play-stamina-strike",
        context,
      ),
    );

    expect(getPlayer(result.state, opponentId).stamina).toBe(staminaBefore - 2);
    expect(getPlayer(result.state, playerId).discardPile).toContain(
      supportCardInstanceId,
    );
    expect(getPlayer(result.state, playerId).battlefield.supportZone).toEqual(
      [],
    );
    expect(result.events.map((entry) => entry.event.type)).toContain(
      "STAMINA_CHANGED",
    );
  });

  it("みなもと減少は予約量と残量を下回らない範囲で適用する", () => {
    const context = createContextWithSupport({
      id: "support-mana-drain",
      name: "みなもと吸収",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "drain-mana",
          type: "reduceMana",
          activationType: "onPlay",
          amount: 10,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["mana"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-mana-drain");
    const playerId = state.firstPlayerId;
    const opponentId = state.secondPlayerId;
    getPlayer(state, opponentId).mana.attributeA.total = 2;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-mana-drain",
    );

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "drain-mana",
              targets: [
                {
                  type: "mana",
                  playerId: opponentId,
                  attribute: "attributeA",
                },
              ],
            },
          ],
        },
        "play-mana-drain",
        context,
      ),
    );

    expect(getPlayer(result.state, opponentId).mana.attributeA.total).toBe(1);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "MANA_REDUCED",
            playerId: opponentId,
            attribute: "attributeA",
            requestedAmount: 10,
            actualAmount: 1,
          }),
        }),
      ]),
    );
  });

  it("カードドローは手札上限と山札枚数の範囲で適用する", () => {
    const context = createContextWithSupport({
      id: "support-draw-one",
      name: "補給",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "draw-one",
          type: "drawCards",
          activationType: "onPlay",
          count: 1,
          targetRule: {
            required: false,
            minTargets: 0,
            maxTargets: 0,
            side: "self",
            zones: [],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-draw-one");
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-draw-one",
    );
    const deckCountBefore = getPlayer(state, playerId).deck.length;

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [{ effectId: "draw-one", targets: [] }],
        },
        "play-draw-one",
        context,
      ),
    );

    expect(getPlayer(result.state, playerId).deck).toHaveLength(
      deckCountBefore - 1,
    );
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "CARDS_DRAWN",
            playerId,
            reason: "effect",
            cardInstanceIds: expect.any(Array),
          }),
        }),
      ]),
    );
    expect(validateGameState(result.state, context)).toEqual({ valid: true });
  });

  it("攻撃グループ除去はグループ内カードを捨て札へ移動する", () => {
    const context = createContextWithSupport({
      id: "support-remove-group",
      name: "グループ除去",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "remove-opponent-group",
          type: "removeAttackGroup",
          activationType: "onPlay",
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["attackGroup"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-remove-group");
    const playerId = state.firstPlayerId;
    const opponentId = state.secondPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-remove-group",
    );
    const targetGroup = getPlayer(state, opponentId).battlefield
      .attackGroups[0];
    if (targetGroup === undefined) {
      throw new Error("相手の攻撃グループがありません。");
    }

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "remove-opponent-group",
              targets: [{ type: "attackGroup", groupId: targetGroup.groupId }],
            },
          ],
        },
        "play-remove-group",
        context,
      ),
    );

    expect(
      getPlayer(result.state, opponentId).battlefield.attackGroups,
    ).toEqual([]);
    expect(getPlayer(result.state, opponentId).discardPile).toEqual(
      expect.arrayContaining(targetGroup.cardIds),
    );
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "ATTACK_GROUP_REMOVED",
            groupId: targetGroup.groupId,
          }),
        }),
      ]),
    );
  });

  it("サポートカード除去は対象を捨て札へ移動する", () => {
    const context = createContextWithSupport({
      id: "support-remove-support",
      name: "サポート除去",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "untilRoundEnd",
      effects: [
        {
          effectId: "remove-opponent-support",
          type: "removeSupportCard",
          activationType: "onPlay",
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["supportCard"],
            allowSourceCard: false,
          },
        },
      ],
    });
    const state = prepareSupportPhase(context, "support-remove-support");
    const playerId = state.firstPlayerId;
    const opponentId = state.secondPlayerId;
    const supportCardInstanceId = findHandCard(
      state,
      playerId,
      "support-remove-support",
    );
    const targetSupportCardInstanceId = findHandCard(
      state,
      opponentId,
      "support-remove-support",
    );
    const opponent = getPlayer(state, opponentId);
    opponent.hand.splice(opponent.hand.indexOf(targetSupportCardInstanceId), 1);
    opponent.battlefield.supportZone.push({
      cardInstanceId: targetSupportCardInstanceId,
      ownerId: opponentId,
      playedRound: state.round,
      playedSequence: 0,
      duration: "untilRoundEnd",
    });
    expect(validateGameState(state, context)).toEqual({ valid: true });

    const result = requireAccepted(
      executeGameCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: [
            {
              effectId: "remove-opponent-support",
              targets: [
                {
                  type: "supportCard",
                  cardInstanceId: targetSupportCardInstanceId,
                },
              ],
            },
          ],
        },
        "play-remove-support",
        context,
      ),
    );

    expect(getPlayer(result.state, opponentId).battlefield.supportZone).toEqual(
      [],
    );
    expect(getPlayer(result.state, opponentId).discardPile).toContain(
      targetSupportCardInstanceId,
    );
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "SUPPORT_CARD_REMOVED",
            playerId: opponentId,
            cardInstanceId: targetSupportCardInstanceId,
          }),
        }),
      ]),
    );
  });
});

function createEffectContext(): GameEngineContext {
  return createContextWithSupport({
    id: "support-group-boost",
    name: "攻撃グループ強化",
    attribute: "attributeA",
    cardType: "support",
    cost: 1,
    duration: "untilRoundEnd",
    effects: [
      {
        effectId: "group-boost",
        type: "modifyPower",
        activationType: "continuous",
        scope: "groupPower",
        operation: "add",
        value: 3,
        targetRule: {
          required: true,
          minTargets: 1,
          maxTargets: 1,
          side: "self",
          zones: ["attackGroup"],
          allowSourceCard: false,
        },
      },
    ],
  });
}

function createContextWithSupport(
  supportDefinition: Omit<SupportCardDefinition, "faction">,
): GameEngineContext {
  const input: CardCatalogInput = createTestCardCatalogInput();
  input.definitions.push(
    { ...supportDefinition, faction: "disaster" },
    {
      ...supportDefinition,
      id: `counter-${supportDefinition.id}`,
      name: `対策${supportDefinition.name}`,
      faction: "countermeasure",
    },
  );
  const baseContext = createTestContext();
  const catalogResult = createCardCatalog(input, {
    rules: baseContext.rules,
    effectRegistry: {},
    engineSemanticsVersion: baseContext.engineSemanticsVersion,
  });
  if (!catalogResult.valid) {
    throw new Error(
      catalogResult.errors.map((error) => error.message).join("\n"),
    );
  }
  return { ...baseContext, cardCatalog: catalogResult.catalog };
}

function createInvalidPlanContext(): GameEngineContext {
  const invalidPlanHandler: CardEffectHandler = {
    validateDefinition: () => ({ valid: true }),
    validate: () => ({ valid: true }),
    plan: (effectContext) => ({
      operations: [
        {
          type: "ADD_ACTIVE_EFFECT",
          effect: {
            effectId: "invalid-plan",
            sourceCardInstanceId: effectContext.sourceCardInstanceId,
            ownerId: effectContext.ownerId,
            target: { type: "attackGroup", groupId: "missing-group" },
            scope: "groupPower",
            operation: "add",
            value: 1,
            duration: "untilRoundEnd",
          },
        },
      ],
    }),
  };
  const input: CardCatalogInput = createTestCardCatalogInput();
  const supportDefinition: Omit<SupportCardDefinition, "faction"> = {
    id: "support-invalid-plan",
    name: "不正計画テスト",
    attribute: "attributeA",
    cardType: "support",
    cost: 1,
    duration: "untilRoundEnd",
    effects: [
      {
        effectId: "invalid-plan",
        type: "custom",
        activationType: "onPlay",
        handlerId: "invalid-plan-handler",
        config: {},
        targetRule: {
          required: true,
          minTargets: 1,
          maxTargets: 1,
          side: "self",
          zones: ["attackGroup"],
          allowSourceCard: false,
        },
      },
    ],
  };
  input.definitions.push(
    { ...supportDefinition, faction: "disaster" },
    {
      ...supportDefinition,
      id: `counter-${supportDefinition.id}`,
      name: `対策${supportDefinition.name}`,
      faction: "countermeasure",
    },
  );
  const baseContext = createTestContext();
  const effectRegistry = { "invalid-plan-handler": invalidPlanHandler };
  const catalogResult = createCardCatalog(input, {
    rules: baseContext.rules,
    effectRegistry,
    engineSemanticsVersion: baseContext.engineSemanticsVersion,
  });
  if (!catalogResult.valid) {
    throw new Error(
      catalogResult.errors.map((error) => error.message).join("\n"),
    );
  }
  return { ...baseContext, cardCatalog: catalogResult.catalog, effectRegistry };
}

function prepareSupportPhase(
  context: GameEngineContext,
  supportDefinitionId = "support-group-boost",
): GameState {
  const deck = createValidDeckDefinitionIds();
  deck[4] = supportDefinitionId;
  const initialized = initializeGame(
    createInitializationInput(deck),
    context,
    createDependencies(
      createSequenceRandomGenerator(Array<number>(59).fill(0.999_999)),
    ),
  );
  if (!initialized.initialized) {
    throw new Error(initialized.error.message);
  }

  let state = initialized.state;
  const firstPlayerId = state.firstPlayerId;
  const firstPlayer = getPlayer(state, firstPlayerId);
  const attackCardInstanceId = moveDeckCardToHand(
    state,
    firstPlayerId,
    "attack-1",
  );
  state = requireAccepted(
    executeGameCommand(
      state,
      firstPlayerId,
      {
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: attackCardInstanceId,
        effectInputs: [],
      },
      "place-target-group",
      context,
    ),
  ).state;
  state = requireAccepted(
    executeGameCommand(
      state,
      firstPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-first-placement",
      context,
    ),
  ).state;
  state = requireAccepted(
    executeGameCommand(
      state,
      state.secondPlayerId,
      {
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: moveDeckCardToHand(
          state,
          state.secondPlayerId,
          "attack-1",
        ),
        effectInputs: [],
      },
      "place-opponent-target-group",
      context,
    ),
  ).state;
  state = requireAccepted(
    executeGameCommand(
      state,
      state.secondPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-second-placement",
      context,
    ),
  ).state;
  expect(firstPlayer.playerId).toBe(firstPlayerId);
  return state;
}

type CommandInput =
  | {
      type: "PLACE_ATTACK_CARD";
      cardInstanceId: string;
      effectInputs: EffectInput[];
    }
  | {
      type: "PLAY_SUPPORT_CARD";
      cardInstanceId: string;
      effectInputs: EffectInput[];
    }
  | { type: "FINISH_PLACEMENT" }
  | { type: "FINISH_SUPPORT" };

function executeGameCommand(
  state: GameState,
  playerId: PlayerId,
  input: CommandInput,
  commandId: string,
  context: GameEngineContext,
) {
  const command: GameCommand = {
    ...input,
    commandId,
    gameId: state.gameId,
    playerId,
    phaseSequence: state.phaseSequence,
    clientStateVersion: state.stateVersion,
    issuedAt: 0,
  } as GameCommand;
  return executeCommand(
    state,
    { command, receivedAt: state.phaseStartedAt + 1 },
    context,
    createDependencies(),
  );
}

function requireAccepted<T extends ReturnType<typeof executeCommand>>(
  result: T,
): Extract<T, { accepted: true }> {
  if (!result.accepted) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result as Extract<T, { accepted: true }>;
}

function getPlayer(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }
  return player;
}

function findHandCard(
  state: GameState,
  playerId: PlayerId,
  definitionId: string,
): string {
  const player = getPlayer(state, playerId);
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const cardInstanceId = player.hand.find(
    (id) => state.cardInstances[id]?.definitionId === factionDefinitionId,
  );
  if (cardInstanceId === undefined) {
    throw new Error(`手札に ${definitionId} がありません。`);
  }
  return cardInstanceId;
}

function moveDeckCardToHand(
  state: GameState,
  playerId: PlayerId,
  definitionId: string,
): string {
  const player = getPlayer(state, playerId);
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const index = player.deck.findIndex(
    (id) => state.cardInstances[id]?.definitionId === factionDefinitionId,
  );
  if (index < 0) {
    throw new Error(`山札に ${definitionId} がありません。`);
  }
  const cardInstanceId = player.deck[index];
  if (cardInstanceId === undefined) {
    throw new Error("山札のカードを取得できません。");
  }
  player.deck.splice(index, 1);
  player.hand.push(cardInstanceId);
  return cardInstanceId;
}
