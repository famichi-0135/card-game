import { describe, expect, it } from "vitest";
import { parseGameCommand } from "../src/index.js";

describe("ゲームコマンドの実行時検証", () => {
  it("全プレイヤーコマンドを型付きのGameCommandとして受理する", () => {
    const base = {
      commandId: "command-1",
      gameId: "game-1",
      playerId: "player-1",
      phaseSequence: 3,
      clientStateVersion: 5,
      issuedAt: 1_000,
    };
    const commands = [
      {
        ...base,
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: "card-1",
        effectInputs: [],
      },
      {
        ...base,
        type: "CHAIN_ATTACK_CARD",
        cardInstanceId: "card-1",
        targetGroupId: "group-1",
        effectInputs: [
          {
            effectId: "effect-1",
            targets: [{ type: "attackGroup", groupId: "group-2" }],
            parameters: { amount: 2, nested: [true, null] },
          },
        ],
      },
      {
        ...base,
        type: "DISCARD_HAND_CARD",
        cardInstanceId: "card-1",
      },
      { ...base, type: "FINISH_PLACEMENT" },
      {
        ...base,
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: "card-1",
        effectInputs: [
          {
            effectId: "effect-1",
            targets: [
              { type: "attackCard", cardInstanceId: "card-2" },
              { type: "supportCard", cardInstanceId: "card-3" },
              { type: "player", playerId: "player-2" },
              { type: "mana", playerId: "player-2", attribute: "attributeA" },
            ],
          },
        ],
      },
      { ...base, type: "FINISH_SUPPORT" },
    ];

    for (const command of commands) {
      expect(parseGameCommand(command)).toMatchObject({
        parsed: true,
        command: { type: command.type },
      });
    }
  });

  it("未知フィールド、空の識別子、非有限数、JSON外の値を拒否する", () => {
    const malformedCommands = [
      {
        type: "FINISH_PLACEMENT",
        commandId: "command-1",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: 1,
        clientStateVersion: 1,
        issuedAt: 1,
        unexpected: true,
      },
      {
        type: "DISCARD_HAND_CARD",
        commandId: " ",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: 1,
        clientStateVersion: 1,
        issuedAt: 1,
        cardInstanceId: "card-1",
      },
      {
        type: "FINISH_SUPPORT",
        commandId: "command-1",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: Number.NaN,
        clientStateVersion: 1,
        issuedAt: 1,
      },
      {
        type: "PLACE_ATTACK_CARD",
        commandId: "command-1",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: 1,
        clientStateVersion: 1,
        issuedAt: 1,
        cardInstanceId: "card-1",
        effectInputs: [
          {
            effectId: "effect-1",
            targets: [],
            parameters: { invalid: undefined },
          },
        ],
      },
    ];

    for (const command of malformedCommands) {
      expect(parseGameCommand(command)).toEqual(
        expect.objectContaining({ parsed: false }),
      );
    }
  });
});
