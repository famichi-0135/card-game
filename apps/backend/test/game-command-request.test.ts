import { describe, expect, it } from "vitest";
import { parseSubmitGameCommandRequest } from "@disastar/contracts/game";

describe("ゲームコマンドリクエストの検証", () => {
  it("DTOの外側とコマンド本体を実行時に検証する", () => {
    const valid = parseSubmitGameCommandRequest({
      command: {
        type: "FINISH_SUPPORT",
        commandId: "command-1",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: 1,
        clientStateVersion: 1,
        issuedAt: 1,
      },
    });
    const unexpectedField = parseSubmitGameCommandRequest({
      command: {},
      playerId: "player-1",
    });
    const malformedCommand = parseSubmitGameCommandRequest({
      command: {
        type: "FINISH_SUPPORT",
        commandId: "command-1",
        gameId: "game-1",
        playerId: "player-1",
        phaseSequence: -1,
        clientStateVersion: 1,
        issuedAt: 1,
      },
    });

    expect(valid).toMatchObject({
      parsed: true,
      request: { command: { type: "FINISH_SUPPORT" } },
    });
    expect(unexpectedField).toEqual({
      parsed: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_SUBMIT_GAME_COMMAND_REQUEST",
        }),
      ],
    });
    expect(malformedCommand).toEqual({
      parsed: false,
      errors: [expect.objectContaining({ code: "INVALID_GAME_COMMAND" })],
    });
  });
});
