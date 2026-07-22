import { describe, expect, it } from "vitest";
import {
  GAME_RULES,
  createCardCatalog,
  initializeGame,
  shuffle,
  validateDeck,
  validateGameRules,
  validateGameState,
} from "../src/index.js";
import type { TargetRule } from "../src/contracts/index.js";
import {
  createAllManaOpeningDeckDefinitionIds,
  createDependencies,
  createInitializationInput,
  createSequenceRandomGenerator,
  createTestCardCatalogInput,
  createTestCatalog,
  createTestContext,
  createValidDeckDefinitionIds,
} from "./fixtures.js";

describe("カードカタログの実行時検証", () => {
  it("有効なカタログを深く凍結して作成する", () => {
    const result = createCardCatalog(createTestCardCatalogInput(), {
      rules: createTestContext().rules,
      effectRegistry: {},
      engineSemanticsVersion: "engine-v1",
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error("有効なカードカタログが拒否されました。");
    }

    expect(Object.isFrozen(result.catalog)).toBe(true);
    expect(Object.isFrozen(result.catalog.definitions)).toBe(true);
    expect(Object.isFrozen(result.catalog.definitions["attack-1"])).toBe(true);
  });

  it("JSON構造、連鎖先、カスタムハンドラーの不整合を拒否する", () => {
    const malformed = createCardCatalog(
      { version: "card-catalog-v1", definitions: [{ id: "invalid" }] },
      {
        rules: createTestContext().rules,
        effectRegistry: {},
        engineSemanticsVersion: "engine-v1",
      },
    );
    expect(malformed.valid).toBe(false);
    if (!malformed.valid) {
      expect(malformed.errors.map((error) => error.code)).toContain(
        "SCHEMA_VALIDATION_FAILED",
      );
    }

    const invalidReferenceInput = createTestCardCatalogInput();
    const attack = invalidReferenceInput.definitions.find(
      (definition) => definition.cardType === "attack",
    );
    if (attack === undefined || attack.cardType !== "attack") {
      throw new Error("テスト用攻撃カードが見つかりません。");
    }
    attack.chainableCardIds.push("missing-attack");
    const invalidReference = createCardCatalog(invalidReferenceInput, {
      rules: createTestContext().rules,
      effectRegistry: {},
      engineSemanticsVersion: "engine-v1",
    });
    expect(invalidReference.valid).toBe(false);
    if (!invalidReference.valid) {
      expect(invalidReference.errors.map((error) => error.code)).toContain(
        "CARD_REFERENCE_NOT_FOUND",
      );
    }

    const crossFactionReferenceInput = createTestCardCatalogInput();
    const crossFactionAttack = crossFactionReferenceInput.definitions.find(
      (definition) => definition.id === "attack-1",
    );
    if (
      crossFactionAttack === undefined ||
      crossFactionAttack.cardType !== "attack"
    ) {
      throw new Error("テスト用攻撃カードが見つかりません。");
    }
    crossFactionAttack.chainableCardIds = ["counter-attack-1"];
    const crossFactionReference = createCardCatalog(
      crossFactionReferenceInput,
      {
        rules: createTestContext().rules,
        effectRegistry: {},
        engineSemanticsVersion: "engine-v1",
      },
    );
    expect(crossFactionReference).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "CROSS_FACTION_CARD_REFERENCE",
        }),
      ]),
    });

    const missingHandlerInput = createTestCardCatalogInput();
    missingHandlerInput.definitions.push({
      id: "support-custom",
      name: "未登録ハンドラー",
      faction: "disaster",
      attribute: "attributeA",
      cardType: "support",
      cost: 0,
      duration: "instant",
      effects: [
        {
          effectId: "custom-effect",
          type: "custom",
          activationType: "onPlay",
          targetRule: createNoTargetRule(),
          handlerId: "missing-handler",
          config: {},
        },
      ],
    });
    const missingHandler = createCardCatalog(missingHandlerInput, {
      rules: createTestContext().rules,
      effectRegistry: {},
      engineSemanticsVersion: "engine-v1",
    });
    expect(missingHandler.valid).toBe(false);
    if (!missingHandler.valid) {
      expect(missingHandler.errors.map((error) => error.code)).toContain(
        "HANDLER_NOT_FOUND",
      );
    }
  });
});

describe("ゲームルール検証", () => {
  it("初期手札枚数が手札上限を超えるルールを拒否する", () => {
    const result = validateGameRules({
      ...GAME_RULES,
      initialDrawCount: GAME_RULES.handLimit + 1,
    });

    expect(result).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_RANGE",
          field: "initialDrawCount",
        }),
      ]),
    });
  });
});

describe("デッキ検証", () => {
  it("有効な30枚デッキを受理する", () => {
    const result = validateDeck(
      createValidDeckDefinitionIds(),
      "disaster",
      createTestCatalog(),
      createTestContext().rules,
    );

    expect(result).toEqual({ valid: true });
  });

  it("枚数、同名制限、属性条件、存在しないカードを検出する", () => {
    const catalog = createTestCatalog();
    const rules = createTestContext().rules;

    const shortDeck = createValidDeckDefinitionIds().slice(0, -1);
    const shortResult = validateDeck(shortDeck, "disaster", catalog, rules);
    expect(shortResult.valid).toBe(false);
    if (!shortResult.valid) {
      expect(shortResult.errors.map((error) => error.code)).toContain(
        "INVALID_DECK_SIZE",
      );
    }

    const duplicateAttackDeck = createValidDeckDefinitionIds();
    duplicateAttackDeck[10] = "attack-1";
    const duplicateAttackResult = validateDeck(
      duplicateAttackDeck,
      "disaster",
      catalog,
      rules,
    );
    expect(duplicateAttackResult.valid).toBe(false);
    if (!duplicateAttackResult.valid) {
      expect(duplicateAttackResult.errors.map((error) => error.code)).toContain(
        "SAME_NAME_LIMIT_EXCEEDED",
      );
    }

    const missingAttributeManaDeck = createValidDeckDefinitionIds();
    missingAttributeManaDeck[7] = "mana-a";
    missingAttributeManaDeck[8] = "mana-a";
    const missingAttributeManaResult = validateDeck(
      missingAttributeManaDeck,
      "disaster",
      catalog,
      rules,
    );
    expect(missingAttributeManaResult.valid).toBe(false);
    if (!missingAttributeManaResult.valid) {
      expect(
        missingAttributeManaResult.errors.map((error) => error.code),
      ).toContain("ATTRIBUTE_REQUIREMENT_NOT_MET");
    }

    const missingCardDeck = createValidDeckDefinitionIds();
    missingCardDeck[0] = "missing-card";
    const missingCardResult = validateDeck(
      missingCardDeck,
      "disaster",
      catalog,
      rules,
    );
    expect(missingCardResult.valid).toBe(false);
    if (!missingCardResult.valid) {
      expect(missingCardResult.errors.map((error) => error.code)).toContain(
        "CARD_DEFINITION_NOT_FOUND",
      );
    }
  });

  it("指定した陣営以外のカードを含むデッキを拒否する", () => {
    const deck = createValidDeckDefinitionIds();
    deck[0] = "counter-mana-a";

    const result = validateDeck(
      deck,
      "disaster",
      createTestCatalog(),
      createTestContext().rules,
    );

    expect(result).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "FACTION_MISMATCH" }),
      ]),
    });
  });
});

describe("決定的シャッフル", () => {
  it("入力を変更せず、同じ乱数列から同じ順番を作る", () => {
    const source = [1, 2, 3, 4];
    const first = shuffle(source, sequenceFrom([0, 0.5, 0.9]));
    const second = shuffle(source, sequenceFrom([0, 0.5, 0.9]));

    expect(source).toEqual([1, 2, 3, 4]);
    expect(first).toEqual([4, 3, 2, 1]);
    expect(second).toEqual(first);
  });

  it("範囲外の乱数値を拒否する", () => {
    expect(() => shuffle([1, 2], sequenceFrom([1]))).toThrow(RangeError);
  });
});

describe("ゲーム初期化", () => {
  it("カード実体、初期みなもと、フェーズ、初期イベントを確定する", () => {
    const identityValues = Array<number>(59).fill(0.999_999);
    const result = initializeGame(
      createInitializationInput(),
      createTestContext(),
      createDependencies(createSequenceRandomGenerator(identityValues)),
    );

    if (!result.initialized) {
      throw new Error(result.error.message);
    }
    expect(result.initialized).toBe(true);

    const firstPlayer = result.state.players["player-1"];
    const secondPlayer = result.state.players["player-2"];

    if (firstPlayer === undefined || secondPlayer === undefined) {
      throw new Error("初期プレイヤー状態が見つかりません。");
    }

    expect(result.state).toMatchObject({
      status: "active",
      round: 1,
      phase: "firstPlayerPlacement",
      phaseSequence: 1,
      phaseStartedAt: 1_000,
      phaseDeadlineAt: 91_000,
      stateVersion: 1,
      firstPlayerId: "player-2",
      secondPlayerId: "player-1",
    });
    expect(firstPlayer).toMatchObject({
      faction: "disaster",
      stamina: 25,
      hand: ["cardInstance:seed-1:card:player-1:4"],
      mana: {
        attributeA: { total: 3 },
        attributeB: { total: 1 },
        attributeC: { total: 0 },
      },
    });
    expect(firstPlayer.deck).toHaveLength(25);
    expect(firstPlayer.discardPile).toHaveLength(4);
    expect(secondPlayer.hand).toHaveLength(1);
    expect(secondPlayer.faction).toBe("countermeasure");
    expect(secondPlayer.discardPile).toHaveLength(4);
    expect(Object.keys(result.state.cardInstances)).toHaveLength(60);

    const allCardIds = [
      ...firstPlayer.deck,
      ...firstPlayer.hand,
      ...firstPlayer.discardPile,
      ...secondPlayer.deck,
      ...secondPlayer.hand,
      ...secondPlayer.discardPile,
    ];
    expect(allCardIds).toHaveLength(60);
    expect(new Set(allCardIds)).toHaveLength(60);
    expect(result.events).toHaveLength(9);
    expect(result.state.nextEventSequence).toBe(10);
  });

  it("同じ陣営のプレイヤー2人では初期化しない", () => {
    const input = createInitializationInput();
    input.players[1].faction = "disaster";
    input.players[1].deckDefinitionIds = createValidDeckDefinitionIds();

    expect(
      initializeGame(input, createTestContext(), createDependencies()),
    ).toMatchObject({
      initialized: false,
      error: { code: "INVALID_FACTION_ASSIGNMENT" },
    });
  });

  it("永続状態で陣営割当やカード所有陣営が壊れた場合に検出する", () => {
    const context = createTestContext();
    const result = initializeGame(
      createInitializationInput(),
      context,
      createDependencies(),
    );
    if (!result.initialized) {
      throw new Error(result.error.message);
    }

    const countermeasurePlayer = result.state.players["player-2"];
    if (countermeasurePlayer === undefined) {
      throw new Error("対策側プレイヤーが見つかりません。");
    }
    countermeasurePlayer.faction = "disaster";

    expect(validateGameState(result.state, context)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_FACTION_ASSIGNMENT" }),
        expect.objectContaining({ code: "CARD_FACTION_MISMATCH" }),
      ]),
    });
  });

  it("全みなもと初期手札を山札へ戻して再シャッフルする", () => {
    const values = [
      ...Array<number>(29).fill(0.999_999),
      0,
      0.04,
      0.08,
      0.12,
      0.16,
      ...Array<number>(24).fill(0.999_999),
      ...Array<number>(29).fill(0.999_999),
      0,
      0.04,
      0.08,
      0.12,
      0.16,
      ...Array<number>(24).fill(0.999_999),
      0.999_999,
    ];
    let calls = 0;
    const result = initializeGame(
      createInitializationInput(createAllManaOpeningDeckDefinitionIds()),
      createTestContext(),
      createDependencies(
        createSequenceRandomGenerator(values, () => {
          calls += 1;
        }),
      ),
    );

    if (!result.initialized) {
      throw new Error(result.error.message);
    }
    expect(result.initialized).toBe(true);

    expect(calls).toBe(117);
    for (const playerId of result.state.playerOrder) {
      const player = result.state.players[playerId];
      if (player === undefined) {
        throw new Error("初期プレイヤー状態が見つかりません。");
      }
      expect(player.hand).toHaveLength(5);
      expect(player.discardPile).toHaveLength(0);
      expect(player.mana).toEqual({
        attributeA: { total: 0 },
        attributeB: { total: 0 },
        attributeC: { total: 0 },
      });
    }
  });

  it("同じ入力とseedから同じ状態とイベント列を再現する", () => {
    const input = createInitializationInput();
    const context = createTestContext();
    const first = initializeGame(input, context, createDependencies());
    const second = initializeGame(input, context, createDependencies());

    expect(first).toEqual(second);
  });
});

function createNoTargetRule(): TargetRule {
  return {
    required: false,
    minTargets: 0,
    maxTargets: 0,
    side: "self",
    zones: [],
    allowSourceCard: false,
  };
}

function sequenceFrom(values: readonly number[]): { next(): number } {
  let index = 0;
  return {
    next: () => {
      const value = values[index];
      index += 1;
      if (value === undefined) {
        throw new Error("テスト用乱数列が不足しています。");
      }
      return value;
    },
  };
}
