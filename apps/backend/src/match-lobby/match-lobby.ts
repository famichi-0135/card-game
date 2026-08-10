import { DurableObject } from "cloudflare:workers";
import type {
  MatchLobbyView as MatchLobbyViewDto,
  MatchVisibility,
} from "@disastar/contracts/match";
import type {
  CardDefinitionId,
  Faction,
  GameId,
  InitializeGameError,
  InitializeGameInput,
  PlayerId,
} from "@disastar/game-engine/contracts";
import {
  abandonGameSessionInEnvironment,
  initializeGameSessionInEnvironment,
} from "../game-creation/create-game-session.js";

const LOBBY_STORAGE_KEY = "match-lobby-v2-factions";
const GAME_ABANDONMENT_RETRY_MS = 30 * 1_000;

export const MATCH_LOBBY_WAIT_DURATION_MS = 30 * 60 * 1_000;

type WaitingMatch = {
  status: "waiting";
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  ownerDeckDefinitionIds: CardDefinitionId[];
  createdAt: number;
  expiresAt: number;
  visibility: MatchVisibility;
};

type StartingMatch = {
  status: "starting";
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  ownerDeckDefinitionIds: CardDefinitionId[];
  opponentPlayerId: PlayerId;
  opponentFaction: Faction;
  opponentDeckDefinitionIds: CardDefinitionId[];
  createdAt: number;
  expiresAt: number;
  visibility: MatchVisibility;
  gameInput: InitializeGameInput;
};

type StartedMatch = {
  status: "started";
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  opponentPlayerId: PlayerId;
  opponentFaction: Faction;
  gameId: GameId;
  createdAt: number;
};

type CancelledMatch = {
  status: "cancelled";
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  createdAt: number;
  pendingGameAbandonment?: InitializeGameInput;
};

type MatchLobbyState =
  | WaitingMatch
  | StartingMatch
  | StartedMatch
  | CancelledMatch;

type LegacyWaitingMatch = Omit<WaitingMatch, "expiresAt" | "visibility"> & {
  expiresAt?: number;
  visibility?: MatchVisibility;
};

type LegacyStartingMatch = Omit<StartingMatch, "expiresAt" | "visibility"> & {
  expiresAt?: number;
  visibility?: MatchVisibility;
};

type StoredMatchLobbyState =
  | MatchLobbyState
  | LegacyWaitingMatch
  | LegacyStartingMatch;

export type MatchLobbyView = MatchLobbyViewDto;

export type GetMatchLobbyViewResult =
  | { visible: true; view: MatchLobbyView }
  | {
      visible: false;
      error: { code: "MATCH_ACCESS_FORBIDDEN" | "MATCH_NOT_FOUND" };
    };

export type GetPublicMatchLobbySummaryResult =
  | {
      available: true;
      summary: {
        ownerFaction: Faction;
        createdAt: number;
        expiresAt: number;
      };
    }
  | { available: false; reason: "starting" | "terminal" };

export type MatchLobbyAcceptResult =
  | { accepted: true; gameId: GameId }
  | {
      accepted: false;
      error: {
        code:
          | "CANNOT_ACCEPT_OWN_MATCH"
          | "MATCH_NOT_ACCEPTING"
          | "MATCH_FACTION_CONFLICT"
          | "MATCH_NOT_FOUND"
          | "GAME_CREATION_FAILED";
        initializationError?: InitializeGameError;
      };
    };

export type MatchLobbyCancelResult =
  | { cancelled: true }
  | {
      cancelled: false;
      error: {
        code:
          | "MATCH_CANCELLATION_FORBIDDEN"
          | "MATCH_NOT_CANCELLABLE"
          | "MATCH_NOT_FOUND";
      };
    };

export type MatchLobbyInitializationResult =
  | { initialized: true }
  | { initialized: false; error: { code: "MATCH_ALREADY_INITIALIZED" } };

type MatchLobbyInitializer = {
  initialize(input: {
    ownerPlayerId: PlayerId;
    ownerFaction: Faction;
    ownerDeckDefinitionIds: CardDefinitionId[];
    createdAt: number;
    expiresAt: number;
    visibility: MatchVisibility;
  }): Promise<MatchLobbyInitializationResult>;
};

export type CreateMatchLobbyInput = {
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  ownerDeckDefinitionIds: CardDefinitionId[];
  visibility?: MatchVisibility;
};

export type CreateMatchLobbyResult =
  | { created: true; matchId: string }
  | { created: false; error: { code: "MATCH_LOBBY_INITIALIZATION_FAILED" } };

/**
 * Workerから待機部屋を作成する。
 * Durable Objectの一意IDを招待識別子にし、公開部屋だけはD1検索インデックスへ別途登録する。
 */
export async function createMatchLobbyInEnvironment(
  input: CreateMatchLobbyInput,
  environment: CloudflareBindings,
  now: () => number = Date.now,
): Promise<CreateMatchLobbyResult> {
  const id = environment.MATCH_LOBBY.newUniqueId();
  const createdAt = now();
  const initialized = await (
    environment.MATCH_LOBBY.get(id) as unknown as MatchLobbyInitializer
  ).initialize({
    ownerPlayerId: input.ownerPlayerId,
    ownerFaction: input.ownerFaction,
    ownerDeckDefinitionIds: input.ownerDeckDefinitionIds,
    visibility: input.visibility ?? "invite",
    createdAt,
    expiresAt: createdAt + MATCH_LOBBY_WAIT_DURATION_MS,
  });

  return initialized.initialized
    ? { created: true, matchId: id.toString() }
    : {
        created: false,
        error: { code: "MATCH_LOBBY_INITIALIZATION_FAILED" },
      };
}

/**
 * 招待式の2人対戦を直列化する Durable Object。
 * HTTP・認証の層は、確定済みのプレイヤーIDだけをこのRPCへ渡す。
 */
export class MatchLobby extends DurableObject<CloudflareBindings> {
  private match: MatchLobbyState | null = null;
  private readonly loadMatch: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadMatch = this.ctx.blockConcurrencyWhile(async () => {
      const stored =
        await this.ctx.storage.get<StoredMatchLobbyState>(LOBBY_STORAGE_KEY);
      const match = migrateStoredMatch(stored, Date.now());
      if (match !== null && match !== stored) {
        await this.persist(match);
        if (match.status === "waiting") {
          await this.ctx.storage.setAlarm(match.expiresAt);
        }
      }
      this.match = match;
    });
  }

  async initialize(input: {
    ownerPlayerId: PlayerId;
    ownerFaction: Faction;
    ownerDeckDefinitionIds: CardDefinitionId[];
    createdAt: number;
    expiresAt?: number;
    visibility?: MatchVisibility;
  }): Promise<MatchLobbyInitializationResult> {
    await this.loadMatch;
    if (this.match !== null) {
      return {
        initialized: false,
        error: { code: "MATCH_ALREADY_INITIALIZED" },
      };
    }
    assertNonEmptyIdentifier(input.ownerPlayerId, "作成者のプレイヤーID");
    assertFaction(input.ownerFaction);
    assertTimestamp(input.createdAt);
    const expiresAt =
      input.expiresAt ?? Date.now() + MATCH_LOBBY_WAIT_DURATION_MS;
    const visibility = input.visibility ?? "invite";
    assertTimestamp(expiresAt);
    if (expiresAt <= input.createdAt) {
      throw new RangeError("待機期限は作成時刻より後で指定してください。");
    }
    assertVisibility(visibility);

    const match: WaitingMatch = {
      status: "waiting",
      ownerPlayerId: input.ownerPlayerId,
      ownerFaction: input.ownerFaction,
      ownerDeckDefinitionIds: [...input.ownerDeckDefinitionIds],
      createdAt: input.createdAt,
      expiresAt,
      visibility,
    };
    await this.persist(match);
    await this.ctx.storage.setAlarm(expiresAt);
    this.match = match;
    return { initialized: true };
  }

  async getView(viewerPlayerId: PlayerId): Promise<GetMatchLobbyViewResult> {
    const match = await this.getMatch();
    if (match === null) {
      return { visible: false, error: { code: "MATCH_NOT_FOUND" } };
    }
    return match.status === "waiting" || isParticipant(match, viewerPlayerId)
      ? { visible: true, view: toMatchLobbyView(match) }
      : { visible: false, error: { code: "MATCH_ACCESS_FORBIDDEN" } };
  }

  async getPublicSummary(): Promise<GetPublicMatchLobbySummaryResult> {
    const match = await this.getMatch();
    if (match?.status === "starting" && match.visibility === "public") {
      return { available: false, reason: "starting" };
    }
    if (
      match === null ||
      match.status !== "waiting" ||
      match.visibility !== "public"
    ) {
      return { available: false, reason: "terminal" };
    }

    return {
      available: true,
      summary: {
        ownerFaction: match.ownerFaction,
        createdAt: match.createdAt,
        expiresAt: match.expiresAt,
      },
    };
  }

  async accept(input: {
    playerId: PlayerId;
    faction: Faction;
    deckDefinitionIds: CardDefinitionId[];
  }): Promise<MatchLobbyAcceptResult> {
    const match = await this.getMatch();
    if (match === null) {
      return { accepted: false, error: { code: "MATCH_NOT_FOUND" } };
    }
    assertNonEmptyIdentifier(input.playerId, "参加者のプレイヤーID");
    assertFaction(input.faction);

    if (match.status === "starting") {
      if (match.opponentPlayerId !== input.playerId) {
        return {
          accepted: false,
          error: { code: "MATCH_NOT_ACCEPTING" },
        };
      }
      return await this.completeStart(match);
    }
    if (match.status !== "waiting") {
      return {
        accepted: false,
        error: { code: "MATCH_NOT_ACCEPTING" },
      };
    }
    if (match.ownerPlayerId === input.playerId) {
      return {
        accepted: false,
        error: { code: "CANNOT_ACCEPT_OWN_MATCH" },
      };
    }
    if (match.ownerFaction === input.faction) {
      return {
        accepted: false,
        error: { code: "MATCH_FACTION_CONFLICT" },
      };
    }

    const starting: StartingMatch = {
      status: "starting",
      ownerPlayerId: match.ownerPlayerId,
      ownerFaction: match.ownerFaction,
      ownerDeckDefinitionIds: match.ownerDeckDefinitionIds,
      opponentPlayerId: input.playerId,
      opponentFaction: input.faction,
      opponentDeckDefinitionIds: [...input.deckDefinitionIds],
      createdAt: match.createdAt,
      expiresAt: match.expiresAt,
      visibility: match.visibility,
      gameInput: {
        gameId: `game-${crypto.randomUUID()}`,
        randomSeed: crypto.randomUUID(),
        players: [
          {
            playerId: match.ownerPlayerId,
            faction: match.ownerFaction,
            deckDefinitionIds: [...match.ownerDeckDefinitionIds],
          },
          {
            playerId: input.playerId,
            faction: input.faction,
            deckDefinitionIds: [...input.deckDefinitionIds],
          },
        ],
      },
    };
    await this.persist(starting);
    this.match = starting;
    return await this.completeStart(starting);
  }

  async cancel(playerId: PlayerId): Promise<MatchLobbyCancelResult> {
    const match = await this.getMatch();
    if (match === null) {
      return { cancelled: false, error: { code: "MATCH_NOT_FOUND" } };
    }
    if (match.ownerPlayerId !== playerId) {
      return {
        cancelled: false,
        error: { code: "MATCH_CANCELLATION_FORBIDDEN" },
      };
    }
    if (match.status !== "waiting" && match.status !== "starting") {
      return {
        cancelled: false,
        error: { code: "MATCH_NOT_CANCELLABLE" },
      };
    }

    const cancelled: CancelledMatch = {
      status: "cancelled",
      ownerPlayerId: match.ownerPlayerId,
      ownerFaction: match.ownerFaction,
      createdAt: match.createdAt,
      ...(match.status === "starting"
        ? { pendingGameAbandonment: match.gameInput }
        : {}),
    };
    await this.persist(cancelled);
    this.match = cancelled;
    if (cancelled.pendingGameAbandonment === undefined) {
      await this.clearAlarm();
    } else {
      await this.reconcileGameAbandonment(cancelled);
    }
    return { cancelled: true };
  }

  async alarm(): Promise<void> {
    const match = await this.getMatch();
    if (
      match?.status === "cancelled" &&
      match.pendingGameAbandonment !== undefined
    ) {
      await this.reconcileGameAbandonment(match);
    }
  }

  private async completeStart(
    match: StartingMatch,
  ): Promise<MatchLobbyAcceptResult> {
    let initialized: Awaited<
      ReturnType<typeof initializeGameSessionInEnvironment>
    >;
    try {
      initialized = await this.initializeGameSession(match.gameInput);
    } catch {
      return await this.handleUnknownStartResult(match);
    }
    if (!initialized.initialized) {
      return await this.restoreWaitingAfterStartFailure(
        match,
        initialized.error,
      );
    }

    const current = this.match;
    if (current?.status === "started") {
      return current.gameId === match.gameInput.gameId
        ? { accepted: true, gameId: current.gameId }
        : { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (current?.status === "cancelled") {
      await this.reconcileGameAbandonment(current);
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (!isSameStartingAttempt(current, match)) {
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (await this.expireMatchIfNecessary(current)) {
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }

    const started: StartedMatch = {
      status: "started",
      ownerPlayerId: match.ownerPlayerId,
      ownerFaction: match.ownerFaction,
      opponentPlayerId: match.opponentPlayerId,
      opponentFaction: match.opponentFaction,
      gameId: match.gameInput.gameId,
      createdAt: match.createdAt,
    };
    await this.persist(started);
    this.match = started;
    await this.clearAlarm();
    return { accepted: true, gameId: started.gameId };
  }

  private initializeGameSession(input: InitializeGameInput) {
    return initializeGameSessionInEnvironment(input, this.env);
  }

  private async handleUnknownStartResult(
    match: StartingMatch,
  ): Promise<MatchLobbyAcceptResult> {
    const current = this.match;
    if (current?.status === "started") {
      return current.gameId === match.gameInput.gameId
        ? { accepted: true, gameId: current.gameId }
        : { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (!isSameStartingAttempt(current, match)) {
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (await this.expireMatchIfNecessary(current)) {
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }

    // RPC例外では相手側だけ初期化済みの可能性があるため、同じ入力で再試行できる状態を保つ。
    return createGameCreationFailure();
  }

  private async restoreWaitingAfterStartFailure(
    match: StartingMatch,
    initializationError?: InitializeGameError,
  ): Promise<MatchLobbyAcceptResult> {
    const current = this.match;
    if (current?.status === "started") {
      return current.gameId === match.gameInput.gameId
        ? { accepted: true, gameId: current.gameId }
        : { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (!isSameStartingAttempt(current, match)) {
      return current?.status === "waiting"
        ? createGameCreationFailure(initializationError)
        : { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }
    if (await this.expireMatchIfNecessary(current)) {
      return { accepted: false, error: { code: "MATCH_NOT_ACCEPTING" } };
    }

    const waiting: WaitingMatch = {
      status: "waiting",
      ownerPlayerId: match.ownerPlayerId,
      ownerFaction: match.ownerFaction,
      ownerDeckDefinitionIds: match.ownerDeckDefinitionIds,
      createdAt: match.createdAt,
      expiresAt: match.expiresAt,
      visibility: match.visibility,
    };
    await this.persist(waiting);
    this.match = waiting;
    return createGameCreationFailure(initializationError);
  }

  private async getMatch(): Promise<MatchLobbyState | null> {
    await this.loadMatch;
    if (this.match !== null) {
      await this.expireMatchIfNecessary(this.match);
    }
    return this.match;
  }

  private async expireMatchIfNecessary(
    match: MatchLobbyState,
  ): Promise<boolean> {
    if (
      (match.status !== "waiting" && match.status !== "starting") ||
      Date.now() < match.expiresAt
    ) {
      return false;
    }

    const cancelled: CancelledMatch = {
      status: "cancelled",
      ownerPlayerId: match.ownerPlayerId,
      ownerFaction: match.ownerFaction,
      createdAt: match.createdAt,
      ...(match.status === "starting"
        ? { pendingGameAbandonment: match.gameInput }
        : {}),
    };
    await this.persist(cancelled);
    this.match = cancelled;
    if (cancelled.pendingGameAbandonment === undefined) {
      await this.clearAlarm();
    } else {
      await this.reconcileGameAbandonment(cancelled);
    }
    return true;
  }

  private async persist(match: MatchLobbyState): Promise<void> {
    await this.ctx.storage.put(LOBBY_STORAGE_KEY, match);
  }

  private async clearAlarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
  }

  private async reconcileGameAbandonment(
    cancelled: CancelledMatch,
  ): Promise<void> {
    const input = cancelled.pendingGameAbandonment;
    if (input === undefined) {
      return;
    }

    try {
      const result = await abandonGameSessionInEnvironment(input, this.env);
      if (!result.abandoned) {
        await this.ctx.storage.setAlarm(Date.now() + GAME_ABANDONMENT_RETRY_MS);
        return;
      }

      const completed: CancelledMatch = {
        status: "cancelled",
        ownerPlayerId: cancelled.ownerPlayerId,
        ownerFaction: cancelled.ownerFaction,
        createdAt: cancelled.createdAt,
      };
      await this.persist(completed);
      if (
        this.match?.status === "cancelled" &&
        this.match.pendingGameAbandonment?.gameId === input.gameId
      ) {
        this.match = completed;
      }
      await this.clearAlarm();
    } catch {
      await this.ctx.storage.setAlarm(Date.now() + GAME_ABANDONMENT_RETRY_MS);
    }
  }
}

function toMatchLobbyView(match: MatchLobbyState): MatchLobbyView {
  switch (match.status) {
    case "waiting":
    case "cancelled":
      return {
        status: match.status,
        ownerPlayerId: match.ownerPlayerId,
        ownerFaction: match.ownerFaction,
        opponentPlayerId: null,
        opponentFaction: null,
        gameId: null,
      };
    case "starting":
      return {
        status: "starting",
        ownerPlayerId: match.ownerPlayerId,
        ownerFaction: match.ownerFaction,
        opponentPlayerId: match.opponentPlayerId,
        opponentFaction: match.opponentFaction,
        gameId: null,
      };
    case "started":
      return {
        status: "started",
        ownerPlayerId: match.ownerPlayerId,
        ownerFaction: match.ownerFaction,
        opponentPlayerId: match.opponentPlayerId,
        opponentFaction: match.opponentFaction,
        gameId: match.gameId,
      };
  }
}

function isParticipant(match: MatchLobbyState, playerId: PlayerId): boolean {
  return (
    match.ownerPlayerId === playerId ||
    ((match.status === "starting" || match.status === "started") &&
      match.opponentPlayerId === playerId)
  );
}

function isSameStartingAttempt(
  current: MatchLobbyState | null,
  expected: StartingMatch,
): current is StartingMatch {
  return (
    current?.status === "starting" &&
    current.gameInput.gameId === expected.gameInput.gameId
  );
}

function createGameCreationFailure(
  initializationError?: InitializeGameError,
): MatchLobbyAcceptResult {
  return {
    accepted: false,
    error: {
      code: "GAME_CREATION_FAILED",
      ...(initializationError === undefined ? {} : { initializationError }),
    },
  };
}

function assertNonEmptyIdentifier(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label}は空文字列にできません。`);
  }
}

function assertTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("作成時刻は0以上の安全な整数で指定してください。");
  }
}

function assertFaction(value: Faction): void {
  if (value !== "disaster" && value !== "countermeasure") {
    throw new RangeError(
      "陣営はdisasterまたはcountermeasureで指定してください。",
    );
  }
}

function assertVisibility(value: MatchVisibility): void {
  if (value !== "invite" && value !== "public") {
    throw new RangeError("公開範囲はinviteまたはpublicで指定してください。");
  }
}

function migrateStoredMatch(
  stored: StoredMatchLobbyState | undefined,
  now: number,
): MatchLobbyState | null {
  if (stored === undefined) {
    return null;
  }
  if (stored.status === "waiting" || stored.status === "starting") {
    const expiresAt = stored.expiresAt;
    const visibility = stored.visibility;
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt === undefined ||
      (visibility !== "invite" && visibility !== "public")
    ) {
      return {
        ...stored,
        expiresAt: now + MATCH_LOBBY_WAIT_DURATION_MS,
        visibility: "invite",
      };
    }
    return {
      ...stored,
      expiresAt,
      visibility,
    };
  }
  return stored;
}
