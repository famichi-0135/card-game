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
  GameSnapshotResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import {
  gameEngineContext,
  gameEngineDependencies,
} from "../game-engine/runtime.js";
import {
  cloneCardCatalog,
  GAME_RECONNECT_GRACE_PERIOD_MS,
  type CatalogRetentionLease,
  type RetainCatalogResult,
} from "../catalog-archive/catalog-archive.js";

const SESSION_STORAGE_KEY = "game-session-v2-factions";

type StoredGameSession = {
  initializationInput: InitializeGameInput;
  state: GameState;
  engineContext?: StoredGameEngineContext;
  retentionExpiresAt?: number | null;
  events: GameEventEnvelope[];
  commandResults: Record<string, StoredCommandResult>;
};

type StoredGameEngineContext = Pick<
  GameEngineContext,
  "rules" | "cardCatalog" | "engineSemanticsVersion"
>;

type StoredCommandResult = {
  authenticatedPlayerId: PlayerId;
  command: GameCommand;
  response: SubmitGameCommandResponse;
};

type CatalogArchiveRpc = {
  retain(lease: CatalogRetentionLease): Promise<RetainCatalogResult>;
};

export type InitializeGameSessionResult =
  | { initialized: true }
  | { initialized: false; error: InitializeGameError };

export type GameSessionAccessErrorCode =
  | "GAME_NOT_FOUND"
  | "GAME_ACCESS_FORBIDDEN"
  | "AUTHENTICATED_PLAYER_MISMATCH"
  | "COMMAND_ID_CONFLICT";

export type GetGameSnapshotResult =
  | { found: true; snapshot: GameSnapshotResponse }
  | { found: false; error: { code: GameSessionAccessErrorCode } };

export type SubmitGameCommandResult =
  | { submitted: true; response: SubmitGameCommandResponse }
  | { submitted: false; error: { code: GameSessionAccessErrorCode } };

export class GameSession extends DurableObject<CloudflareBindings> {
  private session: StoredGameSession | null = null;
  private readonly loadSession: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadSession = this.ctx.blockConcurrencyWhile(async () => {
      const stored =
        (await this.ctx.storage.get<StoredGameSession>(SESSION_STORAGE_KEY)) ??
        null;
      if (stored === null) {
        this.session = null;
        return;
      }
      const migrated = migrateStoredGameSession(stored);
      this.session = migrated.session;
      if (migrated.changed) {
        await this.persist(migrated.session);
      }
    });
  }

  async initialize(
    input: InitializeGameInput,
  ): Promise<InitializeGameSessionResult> {
    const existing = await this.requireSessionOrNull();
    if (existing !== null) {
      if (isSameInitializeInput(existing.initializationInput, input)) {
        await this.syncCatalogRetention(existing);
        await this.syncSessionAlarm(existing);
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
      retentionExpiresAt: null,
      events: initialized.events,
      commandResults: Object.create(null),
    };
    await this.persist(session);
    this.session = session;
    await this.syncCatalogRetention(session);
    await this.syncSessionAlarm(session);
    return { initialized: true };
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
        latestEventSequence: session.state.nextEventSequence - 1,
      },
    };
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

    const storedResult: unknown = session.commandResults[command.commandId];
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
      return { submitted: true, response: storedResult.response };
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
    const nextSession: StoredGameSession = {
      initializationInput: session.initializationInput,
      state: result.state,
      engineContext: getStoredEngineContext(session),
      retentionExpiresAt: getRetentionExpiresAt(result.state, session),
      events: result.accepted
        ? [...session.events, ...result.events]
        : session.events,
      commandResults: {
        ...session.commandResults,
        [command.commandId]: {
          authenticatedPlayerId,
          command: structuredClone(command),
          response,
        },
      },
    };

    await this.persist(nextSession);
    this.session = nextSession;
    await this.syncCatalogRetention(nextSession);
    await this.syncSessionAlarm(nextSession);
    return { submitted: true, response };
  }

  async alarm(): Promise<void> {
    const session = await this.requireSessionOrNull();
    if (session === null) {
      return;
    }

    const retentionExpiresAt = getRetentionExpiresAt(session.state, session);
    if (retentionExpiresAt !== null) {
      if (retentionExpiresAt <= Date.now()) {
        await this.ctx.storage.delete(SESSION_STORAGE_KEY);
        await this.ctx.storage.deleteAlarm();
        this.session = null;
        return;
      }
      await this.syncSessionAlarm(session);
      return;
    }
    if (session.state.phaseDeadlineAt === null) {
      return;
    }

    const result = executeCommand(
      session.state,
      {
        command: {
          type: "HANDLE_PHASE_TIMEOUT",
          gameId: session.state.gameId,
          phaseSequence: session.state.phaseSequence,
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
      await this.syncSessionAlarm(session);
      return;
    }

    const nextSession: StoredGameSession = {
      ...session,
      state: result.state,
      engineContext: getStoredEngineContext(session),
      retentionExpiresAt: getRetentionExpiresAt(result.state, session),
      events: [...session.events, ...result.events],
    };
    await this.persist(nextSession);
    this.session = nextSession;
    await this.syncCatalogRetention(nextSession);
    await this.syncSessionAlarm(nextSession);
  }

  private async requireSessionOrNull(): Promise<StoredGameSession | null> {
    await this.loadSession;
    if (this.session !== null && isRetentionExpired(this.session, Date.now())) {
      await this.ctx.storage.delete(SESSION_STORAGE_KEY);
      await this.ctx.storage.deleteAlarm();
      this.session = null;
    }
    return this.session;
  }

  private async persist(session: StoredGameSession): Promise<void> {
    await this.ctx.storage.put(SESSION_STORAGE_KEY, session);
  }

  private async syncCatalogRetention(
    session: StoredGameSession,
  ): Promise<void> {
    const retained = await getCatalogArchive(this.env).retain({
      gameId: session.state.gameId,
      catalog: getStoredEngineContext(session).cardCatalog,
      expiresAt: getRetentionExpiresAt(session.state, session),
    });
    if (!retained.retained) {
      throw new Error(
        `カードカタログ ${getStoredEngineContext(session).cardCatalog.version} の保持に失敗しました: ${retained.error.code}`,
      );
    }
  }

  private async syncSessionAlarm(session: StoredGameSession): Promise<void> {
    const alarmAt =
      getRetentionExpiresAt(session.state, session) ??
      session.state.phaseDeadlineAt;
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

function migrateStoredGameSession(stored: StoredGameSession): {
  session: StoredGameSession;
  changed: boolean;
} {
  const session = structuredClone(stored);
  let changed = migrateAttackGroupSlots(session.state);

  if (session.engineContext === undefined) {
    const currentContext = cloneEngineContext(gameEngineContext);
    if (
      session.state.rulesetVersion !== currentContext.rules.version ||
      session.state.cardCatalogVersion !== currentContext.cardCatalog.version ||
      session.state.engineSemanticsVersion !==
        currentContext.engineSemanticsVersion
    ) {
      throw new Error(
        "保存済みゲームのバージョン固定コンテキストを復元できません。",
      );
    }
    session.engineContext = currentContext;
    changed = true;
  }

  getStoredEngineContext(session);
  return { session, changed };
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
): number | null {
  if (state.status !== "finished") {
    return null;
  }
  return (
    storedRetentionExpiresAt ??
    state.phaseStartedAt + GAME_RECONNECT_GRACE_PERIOD_MS
  );
}

function getRetentionExpiresAt(
  state: GameState,
  session: StoredGameSession,
): number | null {
  return getGameSessionRetentionExpiresAt(state, session.retentionExpiresAt);
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
    isRecord(value.response)
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
