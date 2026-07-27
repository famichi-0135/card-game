import { describe, expect, it } from "vitest";
import { createGameLearningContext } from "../src/game-learning/game-learning-context.js";

describe("対戦後の学習コンテキスト", () => {
  it("各プレイヤーについて直近の関連記事を最大2種類選び、表示では重複をまとめる", () => {
    const context = createGameLearningContext({
      createdAt: 1_000,
      gameId: "game-learning",
      playedCards: [
        {
          cardDefinitionId: "disaster-attack-8",
          cardName: "台風",
          playerId: "player-1",
          sequence: 3,
        },
        {
          cardDefinitionId: "countermeasure-attack-1",
          cardName: "ハザードマップの確認",
          playerId: "player-2",
          sequence: 4,
        },
        {
          cardDefinitionId: "disaster-attack-8",
          cardName: "台風",
          playerId: "player-2",
          sequence: 5,
        },
        {
          cardDefinitionId: "unrelated-card",
          cardName: "関連記事なし",
          playerId: "player-1",
          sequence: 6,
        },
      ],
      playerIds: ["player-1", "player-2"],
    });

    expect(context.cardsByPlayer).toEqual([
      {
        cardDefinitionIds: ["disaster-attack-8"],
        playerId: "player-1",
      },
      {
        cardDefinitionIds: ["disaster-attack-8", "countermeasure-attack-1"],
        playerId: "player-2",
      },
    ]);
    expect(context.selectedCards).toEqual([
      {
        cardDefinitionId: "disaster-attack-8",
        cardName: "台風",
        usedByPlayerIds: ["player-1", "player-2"],
      },
      {
        cardDefinitionId: "countermeasure-attack-1",
        cardName: "ハザードマップの確認",
        usedByPlayerIds: ["player-2"],
      },
    ]);
  });
});
