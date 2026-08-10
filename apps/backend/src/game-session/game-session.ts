import { DurableObject } from "cloudflare:workers";
import {
  ATTACK_GROUP_SLOT_INDICES,
  createPlayerView,
  executeCommand,
  initializeGame,
  projectEventForPlayer,
} from "@disastar/game-engine";
import type {
  GameEngineContext,
  GameEventEnvelope,
  GameCommand,
  GameState,
  InitializeGameError,
  InitializeGameInput,
  PlayerId,
} from "@disastar/game-engine/contracts";
import type {
  AuthenticatedGameCommand,
  GameRealtimeMessage,
  GameRealtimeUpdate,
  GameLearningContextResponse,
  GameSnapshotResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import {
  findGameEngineContextForVersions,
  gameEngineContext,
  gameEngineDependencies,
} from "../game-engine/runtime.js";
import {
  cloneCardCatalog,
  GAME_RECONNECT_GRACE_PERIOD_MS,
  type CatalogRetentionLease,
  type CatalogRetentionLeaseRenewal,
  type CatalogRetentionLeaseReference,
  type ReleaseCatalogLeaseResult,
  type RenewCatalogLeaseResult,
  type RetainCatalogResult,
} from "../catalog-archive/catalog-archive.js";
import {
  createGameLearningContext,
  type GameLearningContext,
  type PlayedGameCard,
} from "../game-learning/game-learning-context.js";

const SESSION_STORAGE_KEY = "game-session-v2-factions";
const ABANDONMENT_STORAGE_KEY = "game-session-abandonment-v1";
const COMMAND_RESULT_STORAGE_PREFIX = "game-command-result:";
const AUTHENTICATED_PLAYER_ID_HEADER = "X-Disastar-Authenticated-Player-Id";
const ABANDONMENT_CLEANUP_RETRY_MS = 30 * 1_000;

export const MAX_RETAINED_GAME_EVENTS = 1_024;
export const MAX_RETAINED_GAME_EVENT_BYTES = 512 * 1024;
export const MAX_RETAINED_ACCEPTED_COMMAND_RESULTS = 192;
export const MAX_RETAINED_REJECTED_COMMAND_RESULTS = 128;
export const MAX_STORED_COMMAND_RESULT_BYTES = 128 * 1024;

type GameWebSocketAttachment = {
  gameId: string;
  playerId: PlayerId;
};

export type StoredGameSession = {
  initializationInput: InitializeGameInput;
  state: GameState;
  engineContext?: StoredGameEngineContext;
  learningContext?: GameLearningContext | null;
  retentionExpiresAt?: number | null;
  events: GameEventEnvelope[];
  playedCards?: PlayedGameCard[];
  commandResultIndex?: StoredCommandResultIndexEntry[];
  /** v1/v2の埋込形式。DO起動時に個別Storageキーへ移行する。 */
  commandResults?: Record<string, StoredCommandResult>;
};

type StoredCommandResultIndexEntry = {
  commandId: string;
  accepted: boolean;
};

type StoredGameEngineContext = Pick<
  GameEngineContext,
  "rules" | "cardCatalog" | "engineSemanticsVersion"
>;

type StoredGameSessionAbandonment = {
  initializationInput: InitializeGameInput;
  catalogVersion: string;
  expiresAt: number;
  catalogLeaseReleased: boolean;
};

type StoredCommandResult = {
  authenticatedPlayerId: PlayerId;
  command: GameCommand;
  response: SubmitGameCommandResponse;
};

type CatalogArchiveRpc = {
  retain(lease: CatalogRetentionLease): Promise<RetainCatalogResult>;
  renewLease(
    renewal: CatalogRetentionLeaseRenewal,
  ): Promise<RenewCatalogLeaseResult>;
  releaseLease(
    reference: CatalogRetentionLeaseReference,
  ): Promise<ReleaseCatalogLeaseResult>;
};

type CatalogRetentionSyncMode = "none" | "register" | "renew";

export type InitializeGameSessionResult =
  | { initialized: true }
  | { initialized: false; error: InitializeGameError };

export type AbandonGameSessionResult =
  | { abandoned: true }
  | { abandoned: false; error: { code: "GAME_SESSION_CONFLICT" } };

export type GameSessionAccessErrorCode =
  | "GAME_NOT_FOUND"
  | "GAME_ACCESS_FORBIDDEN"
  | "GAME_NOT_FINISHED"
  | "AUTHENTICATED_PLAYER_MISMATCH"
  | "COMMAND_ID_CONFLICT"
  | "COMMAND_RESULT_CAPACITY_REACHED";

export type GetGameSnapshotResult =
  | { found: true; snapshot: GameSnapshotResponse }
  | { found: false; error: { code: GameSessionAccessErrorCode } };

export type SubmitGameCommandResult =
  | { submitted: true; response: SubmitGameCommandResponse }
  | { submitted: false; error: { code: GameSessionAccessErrorCode } };

export type GetGameLearningContextResult =
  | { found: true; context: GameLearningContextResponse }
  | { found: false; error: { code: GameSessionAccessErrorCode } };

export class GameSession extends DurableObject<CloudflareBindings> {
  private session: StoredGameSession | null = null;
  private abandonment: StoredGameSessionAbandonment | null = null;
  private readonly loadSession: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadSession = this.ctx.blockConcurrencyWhile(async () => {
      const [stored, abandonment] = await Promise.all([
        this.ctx.storage.get<StoredGameSession>(SESSION_STORAGE_KEY),
        this.ctx.storage.get<StoredGameSessionAbandonment>(
          ABANDONMENT_STORAGE_KEY,
        ),
      ]);
      this.abandonment = abandonment ?? null;
      if (stored === undefined) {
        this.session = null;
        return;
      }
      if (this.abandonment !== null) {
        this.session = stored ?? null;
        return;
      }
      const migrated = migrateStoredGameSession(stored);
      const commandResultsMigrated = await this.migrateEmbeddedCommandResults(
        migrated.session,
      );
      this.session = commandResultsMigrated.session;
      if (migrated.changed && !commandResultsMigrated.persisted) {
        await this.persist(commandResultsMigrated.session);
      }
    });
  }

  async initialize(
    input: InitializeGameInput,
  ): Promise<InitializeGameSessionResult> {
    await this.loadSession;
    if (this.abandonment !== null) {
      await this.reconcileAbandonment(this.abandonment);
      return createAbandonedInitializationResult();
    }
    const existing = await this.requireSessionOrNull();
    if (existing !== null) {
      if (isSameInitializeInput(existing.initializationInput, input)) {
        // 初回のfull登録が競合・失敗していた可能性があるため、初期化再送では内容比較を省略しない。
        await this.reconcileSessionInfrastructure(existing, "register");
        if (this.abandonment !== null) {
          await this.reconcileAbandonment(this.abandonment);
          return createAbandonedInitializationResult();
        }
        return { initialized: true };
      }
      return {
        initialized: false,
        error: {
          code: "DEPENDENCY_OUTPUT_INVALID",
          message: "このゲームセッションはすでに初期化されています。",
        },
      };
    }

    const engineContext = cloneEngineContext(gameEngineContext);
    const initialized = initializeGame(
      input,
      toGameEngineContext(engineContext),
      gameEngineDependencies,
    );
    if (!initialized.initialized) {
      return initialized;
    }

    const session: StoredGameSession = {
      initializationInput: cloneInitializeInput(input),
      state: initialized.state,
      engineContext,
      learningContext: null,
      retentionExpiresAt: null,
      events: compactGameEvents(initialized.events),
      playedCards: extractPlayedCards(
        initialized.events,
        initialized.state,
        engineContext,
      ),
      commandResultIndex: [],
    };
    await this.persist(session);
    this.session = session;
    await this.reconcileSessionInfrastructure(session, "register");
    if (this.abandonment !== null) {
      await this.reconcileAbandonment(this.abandonment);
      return createAbandonedInitializationResult();
    }
    return { initialized: true };
  }

  async abandon(input: InitializeGameInput): Promise<AbandonGameSessionResult> {
    await this.loadSession;
    const existingAbandonment = this.abandonment;
    if (existingAbandonment !== null) {
      if (
        !isSameInitializeInput(existingAbandonment.initializationInput, input)
      ) {
        return {
          abandoned: false,
          error: { code: "GAME_SESSION_CONFLICT" },
        };
      }
      await this.reconcileAbandonment(existingAbandonment);
      return { abandoned: true };
    }
    if (
      this.session !== null &&
      !isSameInitializeInput(this.session.initializationInput, input)
    ) {
      return {
        abandoned: false,
        error: { code: "GAME_SESSION_CONFLICT" },
      };
    }

    const now = Date.now();
    const abandonment: StoredGameSessionAbandonment = {
      initializationInput: cloneInitializeInput(input),
      catalogVersion:
        this.session === null
          ? gameEngineContext.cardCatalog.version
          : getStoredEngineContext(this.session).cardCatalog.version,
      expiresAt: now + GAME_RECONNECT_GRACE_PERIOD_MS,
      catalogLeaseReleased: false,
    };
    await this.ctx.storage.put(ABANDONMENT_STORAGE_KEY, abandonment);
    this.abandonment = abandonment;
    this.session = null;
    this.closeWebSockets(1001, "対戦開始が取り消されました。");
    await this.ctx.storage.setAlarm(now + ABANDONMENT_CLEANUP_RETRY_MS);
    await this.reconcileAbandonment(abandonment);
    return { abandoned: true };
  }

  async getSnapshot(
    viewerPlayerId: PlayerId,
    afterSequence = 0,
  ): Promise<GetGameSnapshotResult> {
    const session = await this.requireSessionOrNull();
    if (session === null) {
      return { found: false, error: { code: "GAME_NOT_FOUND" } };
    }
    if (!isParticipant(session.state, viewerPlayerId)) {
      return { found: false, error: { code: "GAME_ACCESS_FORBIDDEN" } };
    }
    assertAfterSequence(afterSequence);
    const latestEventSequence = session.state.nextEventSequence - 1;
    const eventRetention = createEventRetentionMetadata(
      session.events,
      afterSequence,
      latestEventSequence,
    );

    return {
      found: true,
      snapshot: {
        view: createPlayerView(
          session.state,
          viewerPlayerId,
          getSessionEngineContext(session),
        ),
        events: session.events
          .filter((envelope) => envelope.sequence > afterSequence)
          .map((envelope) => projectEventForPlayer(envelope, viewerPlayerId))
          .filter(
            (event): event is NonNullable<typeof event> => event !== null,
          ),
        ...eventRetention,
        latestEventSequence,
      },
    };
  }

  async getLearningContext(
    viewerPlayerId: PlayerId,
  ): Promise<GetGameLearningContextResult> {
    const session = await this.requireSessionOrNull();
    if (session === null) {
      return { found: false, error: { code: "GAME_NOT_FOUND" } };
    }
    if (!isParticipant(session.state, viewerPlayerId)) {
      return { found: false, error: { code: "GAME_ACCESS_FORBIDDEN" } };
    }
    if (session.state.status !== "finished") {
      return { found: false, error: { code: "GAME_NOT_FINISHED" } };
    }

    const context =
      session.learningContext ??
      createLearningContextForSession(session, getGameFinishedAt(session));
    return {
      found: true,
      context: {
        gameId: context.gameId,
        createdAt: context.createdAt,
        selectedCards: context.selectedCards,
      },
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }

    const playerId = request.headers.get(AUTHENTICATED_PLAYER_ID_HEADER);
    if (playerId === null) {
      return new Response("Authentication is required.", { status: 401 });
    }

    const session = await this.requireSessionOrNull();
    if (session === null) {
      return new Response("Game session was not found.", { status: 404 });
    }
    if (!isParticipant(session.state, playerId)) {
      return new Response("Game access is forbidden.", { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      gameId: session.state.gameId,
      playerId,
    } satisfies GameWebSocketAttachment);
    server.send(JSON.stringify(createRealtimeUpdate(session.state)));
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  async submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResult> {
    const session = await this.requireSessionOrNull();
    if (session === null) {
      return { submitted: false, error: { code: "GAME_NOT_FOUND" } };
    }
    const { authenticatedPlayerId, command } = authenticatedCommand;
    if (!isParticipant(session.state, authenticatedPlayerId)) {
      return {
        submitted: false,
        error: { code: "GAME_ACCESS_FORBIDDEN" },
      };
    }
    if (command.playerId !== authenticatedPlayerId) {
      return {
        submitted: false,
        error: { code: "AUTHENTICATED_PLAYER_MISMATCH" },
      };
    }

    const storedResult: unknown = await this.getStoredCommandResult(
      session,
      command.commandId,
    );
    if (storedResult !== undefined) {
      if (
        !isStoredCommandResult(storedResult) ||
        storedResult.authenticatedPlayerId !== authenticatedPlayerId ||
        !areEqualJsonValues(storedResult.command, command)
      ) {
        return {
          submitted: false,
          error: { code: "COMMAND_ID_CONFLICT" },
        };
      }
      await this.reconcileSessionInfrastructure(session, "renew");
      if (storedResult.response.accepted) {
        this.broadcastCurrentRealtimeUpdate();
      }
      return { submitted: true, response: storedResult.response };
    }
    if (
      session.commandResultIndex?.some(
        (entry) => entry.commandId === command.commandId,
      ) === true ||
      session.state.processedCommandIds.includes(command.commandId)
    ) {
      throw new Error("保存済みコマンド結果をStorageから復元できません。");
    }

    const result = executeCommand(
      session.state,
      { command, receivedAt: authenticatedCommand.receivedAt },
      getSessionEngineContext(session),
      gameEngineDependencies,
    );
    const response = result.accepted
      ? {
          accepted: true as const,
          commandId: command.commandId,
          view: createPlayerView(
            result.state,
            authenticatedPlayerId,
            getSessionEngineContext(session),
          ),
          events: result.events
            .map((envelope) =>
              projectEventForPlayer(envelope, authenticatedPlayerId),
            )
            .filter(
              (event): event is NonNullable<typeof event> => event !== null,
            ),
        }
      : {
          accepted: false as const,
          commandId: command.commandId,
          error: result.error,
          view: createPlayerView(
            result.state,
            authenticatedPlayerId,
            getSessionEngineContext(session),
          ),
        };
    const newEvents = result.accepted ? result.events : [];
    const allEvents = result.accepted
      ? [...session.events, ...result.events]
      : session.events;
    const nextPlayedCards = [
      ...(session.playedCards ?? []),
      ...extractPlayedCards(
        newEvents,
        result.state,
        getStoredEngineContext(session),
      ),
    ];
    const storedCommandResult: StoredCommandResult = {
      authenticatedPlayerId,
      command: structuredClone(command),
      response,
    };
    if (
      !canRetainCommandResult(session, response.accepted) ||
      !isJsonValueWithinCommandResultStorageLimit(storedCommandResult)
    ) {
      return {
        submitted: false,
        error: { code: "COMMAND_RESULT_CAPACITY_REACHED" },
      };
    }
    const commandResultIndex = [
      ...(session.commandResultIndex ?? []),
      {
        commandId: command.commandId,
        accepted: response.accepted,
      },
    ];
    const nextSession: StoredGameSession = {
      initializationInput: session.initializationInput,
      state: result.state,
      engineContext: getStoredEngineContext(session),
      learningContext: getNextLearningContext(
        session,
        result.state,
        nextPlayedCards,
        authenticatedCommand.receivedAt,
      ),
      retentionExpiresAt: getNextRetentionExpiresAt(
        session,
        result.state,
        authenticatedCommand.receivedAt,
      ),
      events: compactGameEvents(allEvents),
      playedCards: nextPlayedCards,
      commandResultIndex,
      commandResults: undefined,
    };

    await this.persistWithCommandResult(nextSession, storedCommandResult);
    this.session = nextSession;
    await this.reconcileSessionInfrastructure(
      nextSession,
      shouldSyncCatalogRetention(session, nextSession) ? "renew" : "none",
    );
    if (result.accepted) {
      this.broadcastCurrentRealtimeUpdate();
    }
    return { submitted: true, response };
  }

  async alarm(): Promise<void> {
    await this.loadSession;
    if (this.abandonment !== null) {
      await this.reconcileAbandonment(this.abandonment);
      if (
        this.abandonment?.catalogLeaseReleased === true &&
        this.abandonment.expiresAt <= Date.now()
      ) {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.abandonment = null;
        this.session = null;
      }
      return;
    }

    const session = await this.requireSessionOrNull();
    if (session === null) {
      return;
    }

    const retentionExpiresAt = getRetentionExpiresAt(session.state, session);
    if (retentionExpiresAt !== null) {
      if (retentionExpiresAt <= Date.now()) {
        this.closeWebSockets(1001, "ゲームの保持期間が終了しました。");
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
        this.session = null;
        return;
      }
      await this.reconcileSessionInfrastructure(session, "renew");
      this.broadcastCurrentRealtimeUpdate();
      return;
    }
    if (session.state.phaseDeadlineAt === null) {
      return;
    }

    const result = executeCommand(
      session.state,
      {
        command: {
          type: "HANDLE_DISCONNECT_TIMEOUT",
          gameId: session.state.gameId,
          phaseSequence: session.state.phaseSequence,
          disconnectedPlayerIds: getDisconnectedPlayerIds(
            session.state,
            this.getRealtimeConnections().map(
              ({ attachment }) => attachment.playerId,
            ),
          ),
        },
        receivedAt: Date.now(),
      },
      getSessionEngineContext(session),
      gameEngineDependencies,
    );
    if (!result.accepted) {
      throw new Error(
        `フェーズタイムアウトを処理できません: ${result.error.code}`,
      );
    }
    if (result.state === session.state) {
      await this.reconcileSessionInfrastructure(session, "renew");
      this.broadcastCurrentRealtimeUpdate();
      return;
    }

    const nextPlayedCards = [
      ...(session.playedCards ?? []),
      ...extractPlayedCards(
        result.events,
        result.state,
        getStoredEngineContext(session),
      ),
    ];
    const nextSession: StoredGameSession = {
      ...session,
      state: result.state,
      engineContext: getStoredEngineContext(session),
      learningContext: getNextLearningContext(
        session,
        result.state,
        nextPlayedCards,
        Date.now(),
      ),
      retentionExpiresAt: getNextRetentionExpiresAt(
        session,
        result.state,
        Date.now(),
      ),
      events: compactGameEvents([...session.events, ...result.events]),
      playedCards: nextPlayedCards,
    };
    await this.persist(nextSession);
    this.session = nextSession;
    await this.reconcileSessionInfrastructure(
      nextSession,
      shouldSyncCatalogRetention(session, nextSession) ? "renew" : "none",
    );
    this.broadcastCurrentRealtimeUpdate();
  }

  webSocketMessage(webSocket: WebSocket): void {
    webSocket.close(1008, "このWebSocketは更新通知の受信専用です。");
  }

  webSocketClose(webSocket: WebSocket): void {
    this.broadcastPresence(webSocket);
  }

  webSocketError(webSocket: WebSocket): void {
    webSocket.close(1011, "WebSocket接続でエラーが発生しました。");
  }

  private broadcastRealtimeUpdate(session: StoredGameSession): void {
    this.broadcastRealtimeMessage(createRealtimeUpdate(session.state));
  }

  private broadcastCurrentRealtimeUpdate(): void {
    if (this.session !== null) {
      this.broadcastRealtimeUpdate(this.session);
    }
  }

  private broadcastPresence(excludedWebSocket?: WebSocket): void {
    const connections = this.getRealtimeConnections(excludedWebSocket);
    const gameId = connections[0]?.attachment.gameId;
    if (gameId === undefined) {
      return;
    }

    const onlinePlayerIds = [
      ...new Set(connections.map(({ attachment }) => attachment.playerId)),
    ].sort();
    this.broadcastRealtimeMessage(
      {
        type: "GAME_PRESENCE_UPDATED",
        gameId,
        onlinePlayerIds,
      },
      connections,
    );
  }

  private broadcastRealtimeMessage(
    message: GameRealtimeMessage,
    connections = this.getRealtimeConnections(),
  ): void {
    const serialized = JSON.stringify(message);
    for (const { webSocket } of connections) {
      webSocket.send(serialized);
    }
  }

  private getRealtimeConnections(excludedWebSocket?: WebSocket): Array<{
    webSocket: WebSocket;
    attachment: GameWebSocketAttachment;
  }> {
    const connections: Array<{
      webSocket: WebSocket;
      attachment: GameWebSocketAttachment;
    }> = [];
    for (const webSocket of this.ctx.getWebSockets()) {
      if (webSocket === excludedWebSocket) {
        continue;
      }
      const attachment = webSocket.deserializeAttachment();
      if (!isGameWebSocketAttachment(attachment)) {
        webSocket.close(1008, "接続情報を検証できませんでした。");
        continue;
      }
      connections.push({ webSocket, attachment });
    }
    return connections;
  }

  private closeWebSockets(code: number, reason: string): void {
    for (const webSocket of this.ctx.getWebSockets()) {
      webSocket.close(code, reason);
    }
  }

  private async requireSessionOrNull(): Promise<StoredGameSession | null> {
    await this.loadSession;
    if (this.abandonment !== null) {
      return null;
    }
    if (this.session !== null && isRetentionExpired(this.session, Date.now())) {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      this.session = null;
    }
    return this.session;
  }

  private async persist(session: StoredGameSession): Promise<void> {
    await this.ctx.storage.put(SESSION_STORAGE_KEY, session);
  }

  private async reconcileAbandonment(
    abandonment: StoredGameSessionAbandonment,
  ): Promise<void> {
    let current = this.abandonment;
    if (
      current === null ||
      !isSameInitializeInput(
        current.initializationInput,
        abandonment.initializationInput,
      )
    ) {
      return;
    }

    if (!current.catalogLeaseReleased) {
      try {
        await getCatalogArchive(this.env).releaseLease({
          gameId: current.initializationInput.gameId,
          version: current.catalogVersion,
        });
      } catch {
        await this.ctx.storage.setAlarm(
          Date.now() + ABANDONMENT_CLEANUP_RETRY_MS,
        );
        return;
      }
      current = { ...current, catalogLeaseReleased: true };
      await this.ctx.storage.put(ABANDONMENT_STORAGE_KEY, current);
      this.abandonment = current;
    }

    await this.ctx.storage.setAlarm(current.expiresAt);
  }

  private async getStoredCommandResult(
    session: StoredGameSession,
    commandId: string,
  ): Promise<StoredCommandResult | undefined> {
    const embedded = session.commandResults?.[commandId];
    if (embedded !== undefined) {
      return embedded;
    }
    if (
      session.commandResultIndex?.some(
        (entry) => entry.commandId === commandId,
      ) !== true
    ) {
      return undefined;
    }
    return await this.ctx.storage.get<StoredCommandResult>(
      getCommandResultStorageKey(commandId),
    );
  }

  private async persistWithCommandResult(
    session: StoredGameSession,
    commandResult: StoredCommandResult,
  ): Promise<void> {
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(SESSION_STORAGE_KEY, session);
      await transaction.put(
        getCommandResultStorageKey(commandResult.command.commandId),
        commandResult,
      );
    });
  }

  private async migrateEmbeddedCommandResults(
    session: StoredGameSession,
  ): Promise<{
    session: StoredGameSession;
    persisted: boolean;
  }> {
    const embeddedEntries = Object.entries(session.commandResults ?? {});
    if (embeddedEntries.length === 0) {
      return { session, persisted: false };
    }

    let migratedSession = { ...session, commandResults: undefined };
    const retainedResults = new Map<string, StoredCommandResult>();
    const indexedCommandIds = new Set(
      (migratedSession.commandResultIndex ?? []).map(
        (entry) => entry.commandId,
      ),
    );
    for (const [commandId, result] of embeddedEntries) {
      if (
        !isStoredCommandResult(result) ||
        result.command.commandId !== commandId ||
        result.response.commandId !== commandId
      ) {
        throw new Error("旧形式の保存済みコマンド結果を検証できません。");
      }
      const indexed = migratedSession.commandResultIndex?.find(
        (entry) => entry.commandId === commandId,
      );
      if (
        indexed !== undefined &&
        indexed.accepted !== result.response.accepted
      ) {
        throw new Error("旧形式のコマンド結果indexが応答と一致しません。");
      }
      if (!indexedCommandIds.has(commandId)) {
        migratedSession = {
          ...migratedSession,
          commandResultIndex: [
            ...(migratedSession.commandResultIndex ?? []),
            { commandId, accepted: result.response.accepted },
          ],
        };
        indexedCommandIds.add(commandId);
      }
      retainedResults.set(commandId, result);
    }

    const entries = [...retainedResults].map(
      ([commandId, result]) =>
        [getCommandResultStorageKey(commandId), result] as const,
    );
    for (let index = 0; index < entries.length; index += 128) {
      await this.ctx.storage.put(
        Object.fromEntries(entries.slice(index, index + 128)),
      );
    }
    // 埋込結果を残したセッションが正本のままなので、個別キーを先に作っても再試行できる。
    await this.persist(migratedSession);
    return { session: migratedSession, persisted: true };
  }

  /**
   * Storage確定後に外部同期だけが失敗しても、保存済み状態から冪等に復旧する。
   * 再送・Alarm再試行ではカタログリースも再主張し、どこまで成功したかを推測しない。
   */
  private async reconcileSessionInfrastructure(
    session: StoredGameSession,
    catalogRetentionMode: CatalogRetentionSyncMode,
  ): Promise<void> {
    if (catalogRetentionMode !== "none") {
      await this.syncCatalogRetention(session, catalogRetentionMode);
      const currentSession = this.session;
      if (
        currentSession !== null &&
        hasDifferentCatalogRetention(session, currentSession)
      ) {
        await this.syncCatalogRetention(currentSession, "renew");
      }
    }
    await this.syncSessionAlarm(session);
  }

  private async syncCatalogRetention(
    session: StoredGameSession,
    mode: Exclude<CatalogRetentionSyncMode, "none">,
  ): Promise<void> {
    const catalogArchive = getCatalogArchive(this.env);
    const catalog = getStoredEngineContext(session).cardCatalog;
    const lease = {
      gameId: session.state.gameId,
      expiresAt: getRetentionExpiresAt(session.state, session),
    };
    if (mode === "renew") {
      const renewed = await catalogArchive.renewLease({
        ...lease,
        version: catalog.version,
      });
      if (renewed.renewed) {
        return;
      }
    }

    const retained = await catalogArchive.retain({ ...lease, catalog });
    if (!retained.retained) {
      throw new Error(
        `カードカタログ ${catalog.version} の保持に失敗しました: ${retained.error.code}`,
      );
    }
  }

  private async syncSessionAlarm(session: StoredGameSession): Promise<void> {
    const currentSession = this.session;
    if (currentSession === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const sessionToSchedule =
      currentSession === session ? session : currentSession;
    const alarmAt =
      getRetentionExpiresAt(sessionToSchedule.state, sessionToSchedule) ??
      sessionToSchedule.state.phaseDeadlineAt;
    if (alarmAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(alarmAt);
  }
}

function isSameInitializeInput(
  left: InitializeGameInput | undefined,
  right: InitializeGameInput,
): boolean {
  if (left === undefined) {
    return false;
  }
  return (
    left.gameId === right.gameId &&
    left.randomSeed === right.randomSeed &&
    left.players.length === right.players.length &&
    left.players.every((player, index) => {
      const compared = right.players[index];
      return (
        compared !== undefined &&
        player.playerId === compared.playerId &&
        player.faction === compared.faction &&
        player.deckDefinitionIds.length === compared.deckDefinitionIds.length &&
        player.deckDefinitionIds.every(
          (definitionId, deckIndex) =>
            definitionId === compared.deckDefinitionIds[deckIndex],
        )
      );
    })
  );
}

function cloneInitializeInput(input: InitializeGameInput): InitializeGameInput {
  return {
    gameId: input.gameId,
    randomSeed: input.randomSeed,
    players: input.players.map((player) => ({
      playerId: player.playerId,
      faction: player.faction,
      deckDefinitionIds: [...player.deckDefinitionIds],
    })) as InitializeGameInput["players"],
  };
}

function cloneEngineContext(
  context: GameEngineContext,
): StoredGameEngineContext {
  return structuredClone({
    rules: context.rules,
    cardCatalog: cloneCardCatalog(context.cardCatalog),
    engineSemanticsVersion: context.engineSemanticsVersion,
  });
}

function getStoredEngineContext(
  session: StoredGameSession,
): StoredGameEngineContext {
  if (session.engineContext === undefined) {
    throw new Error(
      "ゲームセッションのバージョン固定コンテキストがありません。",
    );
  }
  if (
    session.state.rulesetVersion !== session.engineContext.rules.version ||
    session.state.cardCatalogVersion !==
      session.engineContext.cardCatalog.version ||
    session.state.engineSemanticsVersion !==
      session.engineContext.engineSemanticsVersion
  ) {
    throw new Error(
      "ゲーム状態と保存済みエンジンコンテキストのバージョンが一致しません。",
    );
  }
  return session.engineContext;
}

function toGameEngineContext(
  stored: StoredGameEngineContext,
): GameEngineContext {
  return {
    ...stored,
    effectRegistry: gameEngineContext.effectRegistry,
  };
}

function getSessionEngineContext(
  session: StoredGameSession,
): GameEngineContext {
  return toGameEngineContext(getStoredEngineContext(session));
}

export function migrateStoredGameSession(stored: StoredGameSession): {
  session: StoredGameSession;
  changed: boolean;
} {
  const session = structuredClone(stored);
  let changed = migrateAttackGroupSlots(session.state);
  const finishedAt = getGameFinishedAt(session);

  if (session.engineContext === undefined) {
    const compatibleContext = findGameEngineContextForVersions(session.state);
    if (compatibleContext === null) {
      throw new Error(
        "保存済みゲームのバージョン固定コンテキストを復元できません。",
      );
    }
    session.engineContext = cloneEngineContext(compatibleContext);
    changed = true;
  }

  getStoredEngineContext(session);
  if (session.playedCards === undefined) {
    session.playedCards = extractPlayedCards(
      session.events,
      session.state,
      getStoredEngineContext(session),
    );
    changed = true;
  }
  if (session.commandResultIndex === undefined) {
    session.commandResultIndex = [];
    changed = true;
  } else {
    const uniqueCommandResults = new Map<
      string,
      StoredCommandResultIndexEntry
    >();
    for (const entry of session.commandResultIndex) {
      const existing = uniqueCommandResults.get(entry.commandId);
      if (existing !== undefined && existing.accepted !== entry.accepted) {
        throw new Error("保存済みコマンド結果indexが競合しています。");
      }
      uniqueCommandResults.set(entry.commandId, entry);
    }
    if (uniqueCommandResults.size !== session.commandResultIndex.length) {
      session.commandResultIndex = [...uniqueCommandResults.values()];
      changed = true;
    }
  }
  if (
    session.state.status === "finished" &&
    session.learningContext === undefined
  ) {
    session.learningContext = createLearningContextForSession(
      session,
      finishedAt,
    );
    changed = true;
  }
  const compactedEvents = compactGameEvents(session.events);
  if (compactedEvents.length !== session.events.length) {
    session.events = compactedEvents;
    changed = true;
  }
  return { session, changed };
}

function getNextLearningContext(
  session: StoredGameSession,
  nextState: GameState,
  nextPlayedCards: readonly PlayedGameCard[],
  completedAt: number,
): GameLearningContext | null {
  if (nextState.status !== "finished") {
    return null;
  }
  if (
    session.learningContext !== null &&
    session.learningContext !== undefined
  ) {
    return session.learningContext;
  }

  return createLearningContextForSession(
    { ...session, state: nextState, playedCards: [...nextPlayedCards] },
    completedAt,
  );
}

function createLearningContextForSession(
  session: StoredGameSession,
  createdAt: number,
): GameLearningContext {
  const playedCards =
    session.playedCards ??
    extractPlayedCards(
      session.events,
      session.state,
      getStoredEngineContext(session),
    );

  return createGameLearningContext({
    createdAt,
    gameId: session.state.gameId,
    playedCards,
    playerIds: Object.keys(session.state.players),
  });
}

function extractPlayedCards(
  events: readonly GameEventEnvelope[],
  state: GameState,
  engineContext: StoredGameEngineContext,
): PlayedGameCard[] {
  return events.flatMap((envelope) => {
    const event = envelope.event;
    if (
      event.type !== "ATTACK_GROUP_CREATED" &&
      event.type !== "CARD_CHAINED" &&
      event.type !== "SUPPORT_CARD_PLAYED"
    ) {
      return [];
    }

    const cardDefinitionId =
      typeof event.cardDefinitionId === "string"
        ? event.cardDefinitionId
        : state.cardInstances[event.cardInstanceId]?.definitionId;
    if (cardDefinitionId === undefined) {
      return [];
    }

    const cardName =
      engineContext.cardCatalog.definitions[cardDefinitionId]?.name;
    return cardName === undefined
      ? []
      : [
          {
            cardDefinitionId,
            cardName,
            playerId: event.playerId,
            sequence: envelope.sequence,
          } satisfies PlayedGameCard,
        ];
  });
}

function getGameFinishedAt(session: StoredGameSession): number {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.event.type === "GAME_FINISHED") {
      return event.occurredAt;
    }
  }
  return session.state.phaseStartedAt;
}

/** 保存済みの旧状態に、作成順で固定盤面スロットを割り当てる。 */
export function migrateAttackGroupSlots(state: GameState): boolean {
  let changed = false;
  for (const player of Object.values(state.players)) {
    const occupiedSlots = new Set<number>();
    for (const group of player.battlefield.attackGroups) {
      const slotIndex = (group as { slotIndex?: unknown }).slotIndex;
      if (isValidAttackGroupSlot(slotIndex) && !occupiedSlots.has(slotIndex)) {
        occupiedSlots.add(slotIndex);
        continue;
      }

      const replacement = ATTACK_GROUP_SLOT_INDICES.find(
        (candidate) => !occupiedSlots.has(candidate),
      );
      if (replacement === undefined) {
        throw new Error("攻撃グループの固定枠を割り当てられません。");
      }
      group.slotIndex = replacement;
      occupiedSlots.add(replacement);
      changed = true;
    }
  }
  return changed;
}

function isValidAttackGroupSlot(value: unknown): value is 0 | 1 | 2 | 3 | 4 {
  return (
    Number.isSafeInteger(value) &&
    typeof value === "number" &&
    value >= 0 &&
    value <= 4
  );
}

export function getGameSessionRetentionExpiresAt(
  state: Pick<GameState, "status" | "phaseStartedAt">,
  storedRetentionExpiresAt?: number | null,
  finishedAt = state.phaseStartedAt,
): number | null {
  if (state.status !== "finished") {
    return null;
  }
  return (
    storedRetentionExpiresAt ?? finishedAt + GAME_RECONNECT_GRACE_PERIOD_MS
  );
}

function getNextRetentionExpiresAt(
  session: StoredGameSession,
  nextState: GameState,
  finishedAt: number,
): number | null {
  return getGameSessionRetentionExpiresAt(
    nextState,
    session.retentionExpiresAt,
    finishedAt,
  );
}

function getRetentionExpiresAt(
  state: GameState,
  session: StoredGameSession,
): number | null {
  return getGameSessionRetentionExpiresAt(state, session.retentionExpiresAt);
}

/** 初期化時以外は、再接続猶予の開始時だけカタログの保持期限を更新する。 */
function shouldSyncCatalogRetention(
  previous: StoredGameSession,
  next: StoredGameSession,
): boolean {
  return (
    getRetentionExpiresAt(previous.state, previous) !==
    getRetentionExpiresAt(next.state, next)
  );
}

function hasDifferentCatalogRetention(
  previous: StoredGameSession,
  current: StoredGameSession,
): boolean {
  return (
    getStoredEngineContext(previous).cardCatalog.version !==
      getStoredEngineContext(current).cardCatalog.version ||
    getRetentionExpiresAt(previous.state, previous) !==
      getRetentionExpiresAt(current.state, current)
  );
}

function isRetentionExpired(session: StoredGameSession, now: number): boolean {
  const retentionExpiresAt = getRetentionExpiresAt(session.state, session);
  return retentionExpiresAt !== null && retentionExpiresAt <= now;
}

function getCatalogArchive(environment: CloudflareBindings): CatalogArchiveRpc {
  return environment.CATALOG_ARCHIVE.getByName(
    "card-catalog-retention",
  ) as unknown as CatalogArchiveRpc;
}

function isParticipant(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId] !== undefined;
}

function createAbandonedInitializationResult(): InitializeGameSessionResult {
  return {
    initialized: false,
    error: {
      code: "DEPENDENCY_OUTPUT_INVALID",
      message: "このゲームセッションの開始は取り消されています。",
    },
  };
}

function getDisconnectedPlayerIds(
  state: GameState,
  onlinePlayerIds: readonly PlayerId[],
): PlayerId[] {
  const onlinePlayerIdSet = new Set(onlinePlayerIds);
  return state.playerOrder.filter(
    (playerId) => !onlinePlayerIdSet.has(playerId),
  );
}

function createRealtimeUpdate(state: GameState): GameRealtimeUpdate {
  return {
    type: "GAME_UPDATED",
    gameId: state.gameId,
    stateVersion: state.stateVersion,
    latestEventSequence: state.nextEventSequence - 1,
  };
}

export function compactGameEvents(
  events: readonly GameEventEnvelope[],
): GameEventEnvelope[] {
  const retained: GameEventEnvelope[] = [];
  let serializedBytes = 2;
  for (
    let index = events.length - 1;
    index >= 0 && retained.length < MAX_RETAINED_GAME_EVENTS;
    index -= 1
  ) {
    const event = events[index];
    if (event === undefined) {
      continue;
    }
    const eventBytes = new TextEncoder().encode(JSON.stringify(event)).length;
    const separatorBytes = retained.length === 0 ? 0 : 1;
    if (
      serializedBytes + separatorBytes + eventBytes >
      MAX_RETAINED_GAME_EVENT_BYTES
    ) {
      break;
    }
    retained.push(event);
    serializedBytes += separatorBytes + eventBytes;
  }
  return retained.reverse();
}

export function createEventRetentionMetadata(
  events: readonly GameEventEnvelope[],
  afterSequence: number,
  latestEventSequence: number,
): Pick<
  GameSnapshotResponse,
  "eventsComplete" | "firstAvailableEventSequence"
> {
  const firstAvailableEventSequence =
    events[0]?.sequence ?? latestEventSequence + 1;
  return {
    firstAvailableEventSequence,
    eventsComplete:
      afterSequence <= latestEventSequence &&
      afterSequence >= firstAvailableEventSequence - 1,
  };
}

export function isJsonValueWithinCommandResultStorageLimit(
  value: unknown,
): boolean {
  return (
    new TextEncoder().encode(JSON.stringify(value)).length <=
    MAX_STORED_COMMAND_RESULT_BYTES
  );
}

function canRetainCommandResult(
  session: StoredGameSession,
  accepted: boolean,
): boolean {
  const maximum = accepted
    ? MAX_RETAINED_ACCEPTED_COMMAND_RESULTS
    : MAX_RETAINED_REJECTED_COMMAND_RESULTS;
  return (
    (session.commandResultIndex ?? []).filter(
      (entry) => entry.accepted === accepted,
    ).length < maximum
  );
}

function getCommandResultStorageKey(commandId: string): string {
  return `${COMMAND_RESULT_STORAGE_PREFIX}${encodeURIComponent(commandId)}`;
}

function isGameWebSocketAttachment(
  value: unknown,
): value is GameWebSocketAttachment {
  return (
    isRecord(value) &&
    typeof value.gameId === "string" &&
    typeof value.playerId === "string"
  );
}

function assertAfterSequence(afterSequence: number): void {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new RangeError("イベント連番は0以上の安全な整数で指定してください。");
  }
}

function isStoredCommandResult(value: unknown): value is StoredCommandResult {
  return (
    isRecord(value) &&
    typeof value.authenticatedPlayerId === "string" &&
    isRecord(value.command) &&
    typeof value.command.commandId === "string" &&
    isRecord(value.response) &&
    typeof value.response.accepted === "boolean" &&
    typeof value.response.commandId === "string"
  );
}

function areEqualJsonValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areEqualJsonValues(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && areEqualJsonValues(left[key], right[key]),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
