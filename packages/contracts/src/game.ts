import type {
  CommandId,
  GameCommand,
  GameCommandError,
  PlayerGameView,
  PlayerId,
  PlayerVisibleEventEnvelope,
} from "@disastar/game-engine/contracts";

/** クライアントが送信する、未認証のゲーム操作。 */
export type SubmitGameCommandRequest = {
  command: GameCommand;
};

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
