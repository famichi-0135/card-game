import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  CreateStarterDeckResponse,
  SavedDeckView,
} from "@disastar/contracts/deck";
import type {
  CreateMatchResponse,
  MatchAcceptedResponse,
} from "@disastar/contracts/match";
import type {
  GameRealtimeMessage,
  GameSnapshotResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import { createApp } from "../src/index.js";
import {
  authTestBaseURL as baseURL,
  authTestTrustedOrigin as trustedOrigin,
  createAuthTestBindings,
} from "./auth-test-bindings.js";

describe("2人対戦 Worker 統合", () => {
  it("認証、招待、WebSocket通知、切断・再接続を同じWorker環境で完了する", async () => {
    const app = createApp();
    const sentEmails: EmailMessageBuilder[] = [];
    const bindings = createAuthTestBindings(sentEmails);
    const suffix = crypto.randomUUID();
    const owner = await createVerifiedClient({
      app,
      bindings,
      email: `owner-${suffix}@example.test`,
      name: "Owner",
      sentEmails,
    });
    const opponent = await createVerifiedClient({
      app,
      bindings,
      email: `opponent-${suffix}@example.test`,
      name: "Opponent",
      sentEmails,
    });

    const ownerDeck = await createStarterDeck(
      app,
      bindings,
      owner.cookie,
      "disaster",
    );
    const opponentDeck = await createStarterDeck(
      app,
      bindings,
      opponent.cookie,
      "countermeasure",
    );
    const created = await requestJson<CreateMatchResponse>(
      app,
      bindings,
      "/api/matches",
      owner.cookie,
      { method: "POST", body: { deckId: ownerDeck.id } },
    );
    expect(created.response.status).toBe(201);

    const accepted = await requestJson<MatchAcceptedResponse>(
      app,
      bindings,
      `/api/matches/${encodeURIComponent(created.body.matchId)}/accept`,
      opponent.cookie,
      { method: "POST", body: { deckId: opponentDeck.id } },
    );
    expect(accepted.response.status).toBe(200);
    expect(accepted.body).toMatchObject({ accepted: true });
    if (!accepted.body.accepted) {
      throw new Error("対戦参加が受理されませんでした。");
    }
    const gameId = accepted.body.gameId;

    const ownerSnapshot = await getSnapshot(
      app,
      bindings,
      owner.cookie,
      gameId,
    );
    const opponentSnapshot = await getSnapshot(
      app,
      bindings,
      opponent.cookie,
      gameId,
    );
    expect(ownerSnapshot.view.viewerPlayerId).toBe(owner.playerId);
    expect(opponentSnapshot.view.viewerPlayerId).toBe(opponent.playerId);

    const ownerSocket = await openGameSocket(
      app,
      bindings,
      owner.cookie,
      gameId,
    );
    const ownerInitialUpdate = waitForMessage(
      ownerSocket,
      (message) => message.type === "GAME_UPDATED",
    );
    const opponentSocket = await openGameSocket(
      app,
      bindings,
      opponent.cookie,
      gameId,
    );
    const opponentInitialUpdate = waitForMessage(
      opponentSocket,
      (message) => message.type === "GAME_UPDATED",
    );
    expect(await ownerInitialUpdate).toMatchObject({ gameId });
    expect(await opponentInitialUpdate).toMatchObject({ gameId });

    const currentPlayer =
      ownerSnapshot.view.firstPlayerId === owner.playerId ? owner : opponent;
    const observingSocket =
      currentPlayer === owner ? opponentSocket : ownerSocket;
    const observedSnapshot =
      currentPlayer === owner ? opponentSnapshot : ownerSnapshot;
    const updateAfterCommand = waitForMessage(
      observingSocket,
      (message) =>
        message.type === "GAME_UPDATED" &&
        message.stateVersion > observedSnapshot.view.stateVersion,
    );
    const commandResult = await requestJson<SubmitGameCommandResponse>(
      app,
      bindings,
      `/api/games/${encodeURIComponent(gameId)}/commands`,
      currentPlayer.cookie,
      {
        method: "POST",
        body: {
          command: {
            type: "FINISH_PLACEMENT",
            commandId: `e2e-finish-placement-${suffix}`,
            gameId,
            playerId: currentPlayer.playerId,
            phaseSequence: ownerSnapshot.view.phaseSequence,
            clientStateVersion: ownerSnapshot.view.stateVersion,
            issuedAt: 0,
          },
        },
      },
    );
    expect(commandResult.response.status).toBe(200);
    expect(commandResult.body).toMatchObject({ accepted: true });
    expect(await updateAfterCommand).toMatchObject({ gameId });

    const snapshotAfterNotification = await getSnapshot(
      app,
      bindings,
      currentPlayer === owner ? opponent.cookie : owner.cookie,
      gameId,
      observedSnapshot.latestEventSequence,
    );
    expect(snapshotAfterNotification.view.stateVersion).toBeGreaterThan(
      observedSnapshot.view.stateVersion,
    );

    const ownerPresenceAfterDisconnect = waitForMessage(
      ownerSocket,
      (message) =>
        message.type === "GAME_PRESENCE_UPDATED" &&
        message.onlinePlayerIds.length === 1 &&
        message.onlinePlayerIds[0] === owner.playerId,
    );
    opponentSocket.close(1000, "E2E disconnect");
    await expect(ownerPresenceAfterDisconnect).resolves.toMatchObject({
      gameId,
    });

    const ownerPresenceAfterReconnect = waitForMessage(
      ownerSocket,
      (message) =>
        message.type === "GAME_PRESENCE_UPDATED" &&
        message.onlinePlayerIds.length === 2 &&
        message.onlinePlayerIds.includes(opponent.playerId),
    );
    const reconnectedOpponentSocket = await openGameSocket(
      app,
      bindings,
      opponent.cookie,
      gameId,
    );
    await expect(ownerPresenceAfterReconnect).resolves.toMatchObject({
      gameId,
    });

    ownerSocket.close(1000, "E2E complete");
    reconnectedOpponentSocket.close(1000, "E2E complete");
  });
});

type Client = {
  cookie: string;
  playerId: string;
};

async function createVerifiedClient({
  app,
  bindings,
  email,
  name,
  sentEmails,
}: {
  app: ReturnType<typeof createApp>;
  bindings: CloudflareBindings;
  email: string;
  name: string;
  sentEmails: EmailMessageBuilder[];
}): Promise<Client> {
  const registration = await request(
    app,
    bindings,
    "/api/auth/sign-up/email",
    undefined,
    {
      method: "POST",
      body: { name, email, password: "a-secure-test-password" },
    },
  );
  expect(registration.status).toBe(200);
  const verificationURL = extractActionURL(sentEmails.at(-1)?.text);
  const verificationContext = createExecutionContext();
  const verification = await app.request(
    new Request(verificationURL, { headers: requestHeaders() }),
    undefined,
    bindings,
    verificationContext,
  );
  await waitOnExecutionContext(verificationContext);
  expect(verification.status).toBe(302);

  const signIn = await request(
    app,
    bindings,
    "/api/auth/sign-in/email",
    undefined,
    {
      method: "POST",
      body: { email, password: "a-secure-test-password" },
    },
  );
  expect(signIn.status).toBe(200);
  const cookie = getSessionCookie(signIn);
  const session = await requestJson<{ user: { id: string } }>(
    app,
    bindings,
    "/api/auth/get-session",
    cookie,
  );
  return { cookie, playerId: session.body.user.id };
}

async function createStarterDeck(
  app: ReturnType<typeof createApp>,
  bindings: CloudflareBindings,
  cookie: string,
  faction: "disaster" | "countermeasure",
): Promise<SavedDeckView> {
  const result = await requestJson<CreateStarterDeckResponse>(
    app,
    bindings,
    "/api/decks/starter",
    cookie,
    { method: "POST", body: { faction } },
  );
  expect(result.response.status).toBe(201);
  return result.body.deck;
}

async function getSnapshot(
  app: ReturnType<typeof createApp>,
  bindings: CloudflareBindings,
  cookie: string,
  gameId: string,
  afterSequence = 0,
): Promise<GameSnapshotResponse> {
  const result = await requestJson<GameSnapshotResponse>(
    app,
    bindings,
    `/api/games/${encodeURIComponent(gameId)}?afterSequence=${afterSequence}`,
    cookie,
  );
  expect(result.response.status).toBe(200);
  return result.body;
}

async function openGameSocket(
  app: ReturnType<typeof createApp>,
  bindings: CloudflareBindings,
  cookie: string,
  gameId: string,
): Promise<WebSocket> {
  const response = await request(
    app,
    bindings,
    `/api/games/${encodeURIComponent(gameId)}/events`,
    cookie,
    { headers: { Upgrade: "websocket" } },
  );
  expect(response.status).toBe(101);
  if (response.webSocket === null) {
    throw new Error("ゲームWebSocketを接続できませんでした。");
  }
  response.webSocket.accept();
  return response.webSocket;
}

async function requestJson<T>(
  app: ReturnType<typeof createApp>,
  bindings: CloudflareBindings,
  path: string,
  cookie: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ response: Response; body: T }> {
  const response = await request(app, bindings, path, cookie, init);
  return { response, body: (await response.json()) as T };
}

async function request(
  app: ReturnType<typeof createApp>,
  bindings: CloudflareBindings,
  path: string,
  cookie?: string,
  init: { headers?: HeadersInit; method?: string; body?: unknown } = {},
): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await app.request(
    new Request(`${baseURL}${path}`, {
      method: init.method,
      headers: {
        ...requestHeaders(cookie),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    undefined,
    bindings,
    executionContext,
  );
  await waitOnExecutionContext(executionContext);
  return response;
}

function requestHeaders(cookie?: string): HeadersInit {
  return {
    "cf-connecting-ip": "203.0.113.20",
    "content-type": "application/json",
    origin: trustedOrigin,
    ...(cookie === undefined ? {} : { cookie }),
  };
}

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("認証レスポンスにセッションCookieがありません。");
  }
  return setCookie.split(";", 1)[0] ?? "";
}

function extractActionURL(text: string | undefined): string {
  const actionURL = text?.match(/https:\/\/[^\s]+/)?.[0];
  if (actionURL === undefined) {
    throw new Error("認証メールに操作URLがありません。");
  }
  return actionURL;
}

function waitForMessage(
  webSocket: WebSocket,
  matches: (message: GameRealtimeMessage) => boolean,
): Promise<GameRealtimeMessage> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as GameRealtimeMessage;
      if (matches(message)) {
        webSocket.removeEventListener("message", listener);
        resolve(message);
      }
    };
    webSocket.addEventListener("message", listener);
  });
}
