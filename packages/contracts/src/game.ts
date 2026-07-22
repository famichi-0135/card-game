import { parseGameCommand } from "@disastar/game-engine";
import type {
  CommandId,
  GameCommand,
  GameCommandError,
  GameCommandParseError,
  PlayerGameView,
  PlayerId,
  PlayerVisibleEventEnvelope,
  PublicCardCatalog,
} from "@disastar/game-engine/contracts";

/** クライアントが送信する、未認証のゲーム操作。 */
export type SubmitGameCommandRequest = {
  command: GameCommand;
};

export type SubmitGameCommandRequestParseError =
  | GameCommandParseError
  | {
      code: "INVALID_SUBMIT_GAME_COMMAND_REQUEST";
      message: string;
      path: string;
    };

export type ParseSubmitGameCommandRequestResult =
  | {
      parsed: true;
      request: SubmitGameCommandRequest;
    }
  | {
      parsed: false;
      errors: SubmitGameCommandRequestParseError[];
    };

export function parseSubmitGameCommandRequest(
  input: unknown,
): ParseSubmitGameCommandRequestResult {
  if (!isRecord(input)) {
    return invalidRequest(
      "リクエスト本文はJSONオブジェクトでなければなりません。",
      "",
    );
  }

  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "command") {
    return invalidRequest(
      "リクエスト本文にはcommandだけを含めてください。",
      "",
    );
  }

  const parsed = parseGameCommand(input.command);
  return parsed.parsed
    ? { parsed: true, request: { command: parsed.command } }
    : { parsed: false, errors: parsed.errors };
}

/** バックエンドが認証結果と受信時刻を付与した、エンジン呼び出し用の入力。 */
export type AuthenticatedGameCommand = {
  authenticatedPlayerId: PlayerId;
  receivedAt: number;
  command: GameCommand;
};

export type AcceptedGameCommandResponse = {
  accepted: true;
  commandId: CommandId;
  view: PlayerGameView;
  events: PlayerVisibleEventEnvelope[];
};

export type RejectedGameCommandResponse = {
  accepted: false;
  commandId: CommandId;
  error: GameCommandError;
  view: PlayerGameView;
};

export type SubmitGameCommandResponse =
  | AcceptedGameCommandResponse
  | RejectedGameCommandResponse;

/** 再接続時、またはイベント連番の欠落を検出したときに返す正規状態。 */
export type GameSnapshotResponse = {
  view: PlayerGameView;
  events: PlayerVisibleEventEnvelope[];
  latestEventSequence: number;
};

/** バージョン固定された、表示専用のカードカタログ。 */
export type PublicCardCatalogResponse = {
  catalog: PublicCardCatalog;
};

export type PublicCardCatalogApiErrorResponse = {
  error: {
    code: "CARD_CATALOG_NOT_FOUND";
  };
};

/** HTTPアダプターがゲームエンジンの呼び出し前に返すエラー。 */
export type GameHttpApiErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_AFTER_SEQUENCE"
  | "INVALID_REQUEST"
  | "GAME_ID_MISMATCH"
  | "AUTHENTICATED_PLAYER_MISMATCH"
  | "GAME_NOT_FOUND"
  | "GAME_ACCESS_FORBIDDEN"
  | "COMMAND_ID_CONFLICT";

export type GameHttpApiErrorResponse = {
  error: {
    code: GameHttpApiErrorCode;
  };
  errors?: SubmitGameCommandRequestParseError[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRequest(
  message: string,
  path: string,
): ParseSubmitGameCommandRequestResult {
  return {
    parsed: false,
    errors: [{ code: "INVALID_SUBMIT_GAME_COMMAND_REQUEST", message, path }],
  };
}
