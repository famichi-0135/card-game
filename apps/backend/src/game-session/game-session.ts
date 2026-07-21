import { DurableObject } from "cloudflare:workers";
import {
  createPlayerView,
  executeCommand,
  initializeGame,
  projectEventForPlayer,
} from "@disastar/game-engine";
import type {
  GameEventEnvelope,
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

const SESSION_STORAGE_KEY = "game-session";

type StoredGameSession = {
  state: GameState;
  events: GameEventEnvelope[];
  commandResults: Record<string, SubmitGameCommandResponse>;
};

export type InitializeGameSessionResult =
  | { initialized: true }
  | { initialized: false; error: InitializeGameError };

export class GameSession extends DurableObject<CloudflareBindings> {
  private session: StoredGameSession | null = null;
  private readonly loadSession: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadSession = this.ctx.blockConcurrencyWhile(async () => {
      this.session =
        (await this.ctx.storage.get<StoredGameSession>(SESSION_STORAGE_KEY)) ??
        null;
    });
  }

  async initialize(
    input: InitializeGameInput,
  ): Promise<InitializeGameSessionResult> {
    await this.loadSession;
    if (this.session !== null) {
      return {
        initialized: false,
        error: {
          code: "DEPENDENCY_OUTPUT_INVALID",
          message: "このゲームセッションはすでに初期化されています。",
        },
      };
    }

    const initialized = initializeGame(
      input,
      gameEngineContext,
      gameEngineDependencies,
    );
    if (!initialized.initialized) {
      return initialized;
    }

    const session: StoredGameSession = {
      state: initialized.state,
      events: initialized.events,
      commandResults: Object.create(null),
    };
    await this.persist(session);
    this.session = session;
    await this.syncPhaseAlarm(session.state);
    return { initialized: true };
  }

  async getSnapshot(
    viewerPlayerId: PlayerId,
    afterSequence = 0,
  ): Promise<GameSnapshotResponse> {
    const session = await this.requireSession();
    assertAfterSequence(afterSequence);
    assertParticipant(session.state, viewerPlayerId);

    return {
      view: createPlayerView(session.state, viewerPlayerId),
      events: session.events
        .filter((envelope) => envelope.sequence > afterSequence)
        .map((envelope) => projectEventForPlayer(envelope, viewerPlayerId))
        .filter((event): event is NonNullable<typeof event> => event !== null),
      latestEventSequence: session.state.nextEventSequence - 1,
    };
  }

  async submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResponse> {
    const session = await this.requireSession();
    const { authenticatedPlayerId, command } = authenticatedCommand;
    assertParticipant(session.state, authenticatedPlayerId);
    if (command.playerId !== authenticatedPlayerId) {
      throw new Error(
        "認証済みプレイヤーとコマンドのプレイヤーIDが一致しません。",
      );
    }

    const storedResult = session.commandResults[command.commandId];
    if (storedResult !== undefined) {
      return storedResult;
    }

    const result = executeCommand(
      session.state,
      { command, receivedAt: authenticatedCommand.receivedAt },
      gameEngineContext,
      gameEngineDependencies,
    );
    const response = result.accepted
      ? {
          accepted: true as const,
          commandId: command.commandId,
          view: createPlayerView(result.state, authenticatedPlayerId),
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
          view: createPlayerView(result.state, authenticatedPlayerId),
        };
    const nextSession: StoredGameSession = {
      state: result.state,
      events: result.accepted
        ? [...session.events, ...result.events]
        : session.events,
      commandResults: {
        ...session.commandResults,
        [command.commandId]: response,
      },
    };

    await this.persist(nextSession);
    this.session = nextSession;
    if (result.accepted) {
      await this.syncPhaseAlarm(result.state);
    }
    return response;
  }

  async alarm(): Promise<void> {
    const session = await this.requireSessionOrNull();
    if (session === null || session.state.phaseDeadlineAt === null) {
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
      gameEngineContext,
      gameEngineDependencies,
    );
    if (!result.accepted) {
      throw new Error(
        `フェーズタイムアウトを処理できません: ${result.error.code}`,
      );
    }
    if (result.state === session.state) {
      await this.syncPhaseAlarm(session.state);
      return;
    }

    const nextSession: StoredGameSession = {
      ...session,
      state: result.state,
      events: [...session.events, ...result.events],
    };
    await this.persist(nextSession);
    this.session = nextSession;
    await this.syncPhaseAlarm(nextSession.state);
  }

  private async requireSession(): Promise<StoredGameSession> {
    const session = await this.requireSessionOrNull();
    if (session === null) {
      throw new Error("ゲームセッションはまだ初期化されていません。");
    }
    return session;
  }

  private async requireSessionOrNull(): Promise<StoredGameSession | null> {
    await this.loadSession;
    return this.session;
  }

  private async persist(session: StoredGameSession): Promise<void> {
    await this.ctx.storage.put(SESSION_STORAGE_KEY, session);
  }

  private async syncPhaseAlarm(state: GameState): Promise<void> {
    if (state.phaseDeadlineAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(state.phaseDeadlineAt);
  }
}

function assertParticipant(state: GameState, playerId: PlayerId): void {
  if (state.players[playerId] === undefined) {
    throw new RangeError(
      `プレイヤー ${playerId} はこのゲームに参加していません。`,
    );
  }
}

function assertAfterSequence(afterSequence: number): void {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new RangeError("イベント連番は0以上の安全な整数で指定してください。");
  }
}
