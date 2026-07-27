import type { PlayerId } from "@disastar/game-engine/contracts";

/** ブラウザが認証状態とゲーム用の固定プレイヤーIDを確認するための応答。 */
export type AuthenticatedSessionResponse = {
  isAnonymous: boolean;
  playerId: PlayerId;
  user: {
    id: string;
    name: string;
  };
};

export type SessionApiErrorCode = "UNAUTHENTICATED";

export type SessionApiErrorResponse = {
  error: {
    code: SessionApiErrorCode;
  };
};
