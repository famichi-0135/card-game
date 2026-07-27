import { APIError } from "better-auth/api";
import { PlayerIdentityLinkConflictError } from "../player-identity/resolve-player-id.js";

export const accountLinkConflictCode = "ACCOUNT_LINK_CONFLICT";

/** OAuth コールバックが利用者向けに処理できる認証エラーへ正規化する。 */
export function mapAnonymousAccountLinkError(error: unknown): unknown {
  if (error instanceof PlayerIdentityLinkConflictError) {
    return new APIError("CONFLICT", {
      code: accountLinkConflictCode,
      message:
        "このGoogleアカウントには別のゲームデータが保存されているため、ゲストデータを引き継げません。",
    });
  }

  return error;
}
