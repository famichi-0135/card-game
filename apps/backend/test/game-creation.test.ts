import { describe, expect, it } from "vitest";
import { validateDeck } from "@disastar/game-engine";
import type {
  InitializeGameError,
  InitializeGameInput,
} from "@disastar/game-engine/contracts";
import { createGameSession } from "../src/game-creation/create-game-session.js";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
  gameEngineContext,
} from "../src/game-engine/runtime.js";

describe("初期カードカタログ", () => {
  it("固定バージョンの効果付きカードと合法なスターターデッキを提供する", () => {
    const disasterDeck = createDisasterStarterDeckDefinitionIds();
    const countermeasureDeck = createCountermeasureStarterDeckDefinitionIds();
    const disasterResult = validateDeck(
      disasterDeck,
      "disaster",
      gameEngineContext.cardCatalog,
      gameEngineContext.rules,
    );
    const countermeasureResult = validateDeck(
      countermeasureDeck,
      "countermeasure",
      gameEngineContext.cardCatalog,
      gameEngineContext.rules,
    );

    expect(gameEngineContext.cardCatalog.version).toBe(
      "initial-catalog-v3-presentation",
    );
    expect(disasterResult).toEqual({ valid: true });
    expect(countermeasureResult).toEqual({ valid: true });
    expect(disasterDeck).toHaveLength(gameEngineContext.rules.deckSize);
    expect(countermeasureDeck).toHaveLength(gameEngineContext.rules.deckSize);
    expect(
      disasterDeck.some((cardId) => countermeasureDeck.includes(cardId)),
    ).toBe(false);
    expect(
      gameEngineContext.cardCatalog.definitions["disaster-support-group-boost"],
    ).toMatchObject({
      cardType: "support",
      duration: "untilRoundEnd",
      effects: [
        expect.objectContaining({
          type: "modifyPower",
          activationType: "continuous",
        }),
      ],
    });
    expect(
      gameEngineContext.cardCatalog.definitions[
        "countermeasure-support-destroy-draw"
      ],
    ).toMatchObject({
      cardType: "support",
      effects: [
        expect.objectContaining({ type: "removeAttackGroup" }),
        expect.objectContaining({ type: "drawCards" }),
      ],
    });
  });
});

describe("対戦作成サービス", () => {
  it("サーバー生成のゲームIDと乱数seedでゲームセッションを初期化する", async () => {
    const initializedInputs: InitializeGameInput[] = [];
    const disasterDeck = createDisasterStarterDeckDefinitionIds();
    const countermeasureDeck = createCountermeasureStarterDeckDefinitionIds();

    const result = await createGameSession(
      {
        players: [
          {
            playerId: "player-1",
            faction: "disaster",
            deckDefinitionIds: disasterDeck,
          },
          {
            playerId: "player-2",
            faction: "countermeasure",
            deckDefinitionIds: countermeasureDeck,
          },
        ],
      },
      {
        createGameId: () => "game-created-by-server",
        createRandomSeed: () => "seed-created-by-server",
        getGameSession: (gameId) => {
          expect(gameId).toBe("game-created-by-server");
          return {
            initialize: async (input) => {
              initializedInputs.push(input);
              return { initialized: true };
            },
          };
        },
      },
    );

    expect(result).toEqual({
      created: true,
      gameId: "game-created-by-server",
    });
    expect(initializedInputs).toEqual([
      {
        gameId: "game-created-by-server",
        randomSeed: "seed-created-by-server",
        players: [
          {
            playerId: "player-1",
            faction: "disaster",
            deckDefinitionIds: disasterDeck,
          },
          {
            playerId: "player-2",
            faction: "countermeasure",
            deckDefinitionIds: countermeasureDeck,
          },
        ],
      },
    ]);
  });

  it("ゲームエンジンの初期化エラーを作成失敗として返す", async () => {
    const initializationError: InitializeGameError = {
      code: "DECK_VALIDATION_FAILED",
      message: "デッキが条件を満たしていません。",
    };

    const result = await createGameSession(
      {
        players: [
          { playerId: "player-1", faction: "disaster", deckDefinitionIds: [] },
          {
            playerId: "player-2",
            faction: "countermeasure",
            deckDefinitionIds: [],
          },
        ],
      },
      {
        createGameId: () => "game-invalid-deck",
        createRandomSeed: () => "seed-invalid-deck",
        getGameSession: () => ({
          initialize: async () => ({
            initialized: false,
            error: initializationError,
          }),
        }),
      },
    );

    expect(result).toEqual({ created: false, error: initializationError });
  });
});
