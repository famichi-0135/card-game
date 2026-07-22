import { DurableObject } from "cloudflare:workers";
import type { MatchLobbyView as MatchLobbyViewDto } from "@disastar/contracts/match";
import type {
  CardDefinitionId,
  Faction,
  GameId,
  InitializeGameError,
  InitializeGameInput,
  PlayerId,
} from "@disastar/game-engine/contracts";
import { initializeGameSessionInEnvironment } from "../game-creation/create-game-session.js";

const LOBBY_STORAGE_KEY = "match-lobby-v2-factions";

type WaitingMatch = {
  status: "waiting";
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  ownerDeckDefinitionIds: CardDefinitionId[];
  createdAt: number;
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
};

type MatchLobbyState =
  | WaitingMatch
  | StartingMatch
  | StartedMatch
  | CancelledMatch;

export type MatchLobbyView = MatchLobbyViewDto;

export type GetMatchLobbyViewResult =
  | { visible: true; view: MatchLobbyView }
  | {
      visible: false;
      error: { code: "MATCH_ACCESS_FORBIDDEN" | "MATCH_NOT_FOUND" };
    };

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
  }): Promise<MatchLobbyInitializationResult>;
};

export type CreateMatchLobbyInput = {
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  ownerDeckDefinitionIds: CardDefinitionId[];
};

export type CreateMatchLobbyResult =
  | { created: true; matchId: string }
  | { created: false; error: { code: "MATCH_LOBBY_INITIALIZATION_FAILED" } };

/**
 * Workerから招待式の待機部屋を作成する。
 * Durable Objectの一意IDをそのまま招待識別子にするため、グローバルな待機部屋索引は持たない。
 */
export async function createMatchLobbyInEnvironment(
  input: CreateMatchLobbyInput,
  environment: CloudflareBindings,
  now: () => number = Date.now,
): Promise<CreateMatchLobbyResult> {
  const id = environment.MATCH_LOBBY.newUniqueId();
  const initialized = await (
    environment.MATCH_LOBBY.get(id) as unknown as MatchLobbyInitializer
  ).initialize({
    ownerPlayerId: input.ownerPlayerId,
    ownerFaction: input.ownerFaction,
    ownerDeckDefinitionIds: input.ownerDeckDefinitionIds,
    createdAt: now(),
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
      this.match =
        (await this.ctx.storage.get<MatchLobbyState>(LOBBY_STORAGE_KEY)) ??
        null;
    });
  }

  async initialize(input: {
    ownerPlayerId: PlayerId;
    ownerFaction: Faction;
    ownerDeckDefinitionIds: CardDefinitionId[];
    createdAt: number;
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

    const match: WaitingMatch = {
      status: "waiting",
      ownerPlayerId: input.ownerPlayerId,
      ownerFaction: input.ownerFaction,
      ownerDeckDefinitionIds: [...input.ownerDeckDefinitionIds],
      createdAt: input.createdAt,
    };
    await this.persist(match);
    this.match = match;
    return { initialized: true };
  }

  async getView(viewerPlayerId: PlayerId): Promise<GetMatchLobbyViewResult> {
    const match = await this.getMatch();
    if (match === null) {
      return { visible: false, error: { code: "MATCH_NOT_FOUND" } };
    }
    return isParticipant(match, viewerPlayerId)
      ? { visible: true, view: toMatchLobbyView(match) }
      : { visible: false, error: { code: "MATCH_ACCESS_FORBIDDEN" } };
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
    if (match.status !== "waiting") {
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
    };
    await this.persist(cancelled);
    this.match = cancelled;
    return { cancelled: true };
  }

  private async completeStart(
    match: StartingMatch,
  ): Promise<MatchLobbyAcceptResult> {
    const initialized = await initializeGameSessionInEnvironment(
      match.gameInput,
      this.env,
    );
    if (!initialized.initialized) {
      const waiting: WaitingMatch = {
        status: "waiting",
        ownerPlayerId: match.ownerPlayerId,
        ownerFaction: match.ownerFaction,
        ownerDeckDefinitionIds: match.ownerDeckDefinitionIds,
        createdAt: match.createdAt,
      };
      await this.persist(waiting);
      this.match = waiting;
      return {
        accepted: false,
        error: {
          code: "GAME_CREATION_FAILED",
          initializationError: initialized.error,
        },
      };
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
    return { accepted: true, gameId: started.gameId };
  }

  private async getMatch(): Promise<MatchLobbyState | null> {
    await this.loadMatch;
    return this.match;
  }

  private async persist(match: MatchLobbyState): Promise<void> {
    await this.ctx.storage.put(LOBBY_STORAGE_KEY, match);
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
