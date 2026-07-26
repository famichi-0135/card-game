import { describe, expect, expectTypeOf, it } from "vitest";
import { GAME_RULES } from "../src/contracts/index.js";
import type {
  GameCommand,
  GameEngineContext,
  PlayerGameView,
  ReceivedCommandEnvelope,
} from "../src/contracts/index.js";

describe("ゲームエンジン契約", () => {
  it("基本ルールを不変の既定値として公開する", () => {
    expect(GAME_RULES).toMatchObject({
      version: "ruleset-v3-starter-balance",
      playerCount: 2,
      deckSize: 30,
      initialStamina: 25,
      minManaCards: 12,
      maxManaCards: 15,
      minAttackCards: 10,
      maxAttackCards: 15,
      maxSupportCards: 6,
    });
  });

  it("通信境界に必要な主要型を維持する", () => {
    expectTypeOf<GameCommand>().toMatchTypeOf<
      ReceivedCommandEnvelope["command"]
    >();
    expectTypeOf<PlayerGameView["stateVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<
      GameEngineContext["engineSemanticsVersion"]
    >().toEqualTypeOf<string>();
  });
});
