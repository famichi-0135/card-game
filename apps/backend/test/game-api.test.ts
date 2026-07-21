import { describe, expect, it } from "vitest";
import type {
  AuthenticatedGameCommand,
  GameSnapshotResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import { createGameApi } from "../src/game-api/create-game-api.js";
import worker from "../src/index.js";

const snapshot = {
  view: {
    gameId: "game-1",
    viewerPlayerId: "player-1",
  },
  events: [],
  latestEventSequence: 3,
} as unknown as GameSnapshotResponse;

const acceptedResponse = {
  accepted: true,
  commandId: "command-1",
  view: snapshot.view,
  events: [],
} as SubmitGameCommandResponse;

describe("ゲーム HTTP API", () => {
  it("標準Workerは認証アダプター未接続時にゲームAPIを拒否する", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/games/game-1"),
      {} as CloudflareBindings,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("認証できないリクエストを Durable Object へ渡さない", async () => {
    let resolved = false;
    const app = createGameApi({
      authenticate: async () => null,
      getGameSession: () => {
        resolved = true;
        throw new Error("認証前に Durable Object を解決してはいけません。");
      },
    });

    const response = await request(app, "/game-1");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(resolved).toBe(false);
  });

  it("認証済みプレイヤーのスナップショット取得を Durable Object へ中継する", async () => {
    const received: Array<{ viewerPlayerId: string; afterSequence: number }> =
      [];
    const app = createGameApi({
      authenticate: async () => "player-1",
      getGameSession: (gameId) => ({
        getSnapshot: async (viewerPlayerId, afterSequence) => {
          expect(gameId).toBe("game-1");
          received.push({ viewerPlayerId, afterSequence: afterSequence ?? 0 });
          return snapshot;
        },
        submit: async () => acceptedResponse,
      }),
    });

    const response = await request(app, "/game-1?afterSequence=2");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(received).toEqual([
      { viewerPlayerId: "player-1", afterSequence: 2 },
    ]);
  });

  it("不正な本文と不正なイベント連番を Durable Object の前で拒否する", async () => {
    let resolved = false;
    const app = createGameApi({
      authenticate: async () => "player-1",
      getGameSession: () => {
        resolved = true;
        throw new Error("不正な入力で Durable Object を解決してはいけません。");
      },
    });

    const invalidSequence = await request(app, "/game-1?afterSequence=-1");
    const invalidBody = await request(app, "/game-1/commands", {
      method: "POST",
      body: JSON.stringify({ command: { type: "FINISH_SUPPORT" } }),
    });

    expect(invalidSequence.status).toBe(400);
    expect(await invalidSequence.json()).toEqual({
      error: { code: "INVALID_AFTER_SEQUENCE" },
    });
    expect(invalidBody.status).toBe(400);
    const invalidBodyResponse = (await invalidBody.json()) as {
      error: { code: string };
      errors: Array<{ code: string }>;
    };
    expect(invalidBodyResponse).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(invalidBodyResponse.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_GAME_COMMAND" }),
      ]),
    );
    expect(resolved).toBe(false);
  });

  it("本文のプレイヤーIDが認証結果と異なるコマンドを拒否する", async () => {
    let resolved = false;
    const app = createGameApi({
      authenticate: async () => "player-1",
      getGameSession: () => {
        resolved = true;
        throw new Error(
          "プレイヤー不一致で Durable Object を解決してはいけません。",
        );
      },
    });

    const response = await request(app, "/game-1/commands", {
      method: "POST",
      body: JSON.stringify({
        command: createFinishPlacementCommand({ playerId: "player-2" }),
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "AUTHENTICATED_PLAYER_MISMATCH" },
    });
    expect(resolved).toBe(false);
  });

  it("本文のゲームIDがパスと異なるコマンドを拒否する", async () => {
    let resolved = false;
    const app = createGameApi({
      authenticate: async () => "player-1",
      getGameSession: () => {
        resolved = true;
        throw new Error(
          "ゲームID不一致で Durable Object を解決してはいけません。",
        );
      },
    });

    const response = await request(app, "/game-1/commands", {
      method: "POST",
      body: JSON.stringify({
        command: createFinishPlacementCommand({ gameId: "game-2" }),
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "GAME_ID_MISMATCH" },
    });
    expect(resolved).toBe(false);
  });

  it("検証済みコマンドに認証結果とサーバー受信時刻を付与して送信する", async () => {
    const submitted: AuthenticatedGameCommand[] = [];
    const app = createGameApi({
      authenticate: async () => "player-1",
      now: () => 1_234,
      getGameSession: (gameId) => ({
        getSnapshot: async () => snapshot,
        submit: async (command) => {
          expect(gameId).toBe("game-1");
          submitted.push(command);
          return acceptedResponse;
        },
      }),
    });
    const command = createFinishPlacementCommand();

    const response = await request(app, "/game-1/commands", {
      method: "POST",
      body: JSON.stringify({ command }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(acceptedResponse);
    expect(submitted).toEqual([
      {
        authenticatedPlayerId: "player-1",
        receivedAt: 1_234,
        command,
      },
    ]);
  });
});

async function request(
  app: ReturnType<typeof createGameApi>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return await app.fetch(
    new Request(`http://example.com${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    }),
    {} as CloudflareBindings,
  );
}

function createFinishPlacementCommand({
  gameId = "game-1",
  playerId = "player-1",
}: { gameId?: string; playerId?: string } = {}) {
  return {
    type: "FINISH_PLACEMENT" as const,
    commandId: "command-1",
    gameId,
    playerId,
    phaseSequence: 1,
    clientStateVersion: 1,
    issuedAt: 10,
  };
}
