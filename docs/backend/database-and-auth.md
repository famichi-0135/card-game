# データベース・認証基盤

## 責務

バックエンドの永続データは Cloudflare D1、スキーマとマイグレーションは Drizzle、認証は Better Auth を使用する。初期ローンチでは **匿名ゲスト** と **Google OAuth** を提供し、メール・パスワード認証、確認メール、パスワード再設定、Cloudflare Email Service は使用しない。

- `apps/backend/src/db/schema/`: Drizzle スキーマの正本
- `apps/backend/drizzle/`: レビュー・適用する SQL マイグレーション
- `apps/backend/src/db/runtime.ts`: Workers の `env.DB` から作る実行時 Drizzle
- `apps/backend/src/auth/create-auth.ts`: Google OAuth、匿名ゲスト、アカウント引き継ぎを含む Better Auth 設定
- `apps/backend/src/auth/runtime-auth.ts`: リクエストごとの Better Auth 生成、セッション認証、ゲーム用PlayerIdの解決
- `apps/backend/src/player-identity/`: Better Auth利用者とゲーム用PlayerIdの対応表を解決する処理
- `apps/backend/src/match-lobby/public-match-lobby-index.ts`: 公開待機部屋を検索するD1インデックス
- `apps/backend/src/db/migration.ts`: Better Auth CLI がスキーマを検査するための Drizzle
- `apps/backend/auth.cli.ts`: Better Auth CLI 専用設定
- `apps/backend/drizzle.config.ts`: Drizzle Kit 専用設定

CLI 用の疑似 D1 クライアントを Workers のリクエスト処理へ持ち込まない。実行時はリクエストの `CloudflareBindings.DB` から Drizzle を作る。

## Google OAuth と匿名ゲストの運用仕様

ログイン画面は `POST /api/auth/sign-in/social` に `provider: "google"` を送信し、Better Auth が返す認可 URL へブラウザを遷移させる。初回ログイン時は Better Auth が Google の subject を `account` テーブルへ保存し、以後は同じ Google アカウントを同じアプリ利用者として扱う。

要求するスコープは `openid`、`email`、`profile` だけとする。Google API の操作権限やオフラインアクセスは要求しない。Google から検証済みとして返るメールアドレスと表示名、プロフィール画像だけを利用者情報として保存する。

`BETTER_AUTH_URL`は、ブラウザから到達できる Frontend Worker の公開オリジンである。Better Auth の Google callback URI は次の形で固定する。

```text
<BETTER_AUTH_URL>/api/auth/callback/google
```

ローカル、staging、production の URI は Google Cloud Console の OAuth 2.0 クライアントに個別に完全一致で登録する。staging と production の公開 URL は、デプロイ前に管理者が確定してから追加する。ワイルドカード、Backend Worker の内部名、未管理のプレビュー URL は登録しない。

Google OAuth に失敗した場合、フロントエンドは認可エラーを表示してログイン画面へ留まる。対戦画面と待機部屋へ未ログインでアクセスした場合は、同一オリジン内に限定して検証した `returnTo` を付けて `/login` へ移動する。認証成功後はその URL へ戻る。

匿名ゲストは `POST /api/auth/sign-in/anonymous` で作成する。Better AuthのAnonymousプラグインが一意な仮メールアドレス、`ゲスト-xxxxxxxx`形式の表示名、`user.is_anonymous = true`、セッションCookieを作成する。仮メールアドレスは画面・アプリAPI・ログへ返さない。ゲストはGoogle利用者と同じ対戦、待機部屋、保存済みデッキAPIを利用できるが、Cookieを失うとGoogleへ引き継ぐまで同じゲストとして復元できない。

匿名ゲストがGoogleログインを開始すると、Anonymousプラグインの`onLinkAccount`で`player_identity.auth_user_id`を新しいGoogle利用者IDへ更新する。そのため、ゲストが作成したDurable Object、待機部屋、対戦、保存済みデッキの`PlayerId`は変わらない。引き継ぎ先のGoogle利用者がすでに別の`PlayerId`を持つ場合は`409 { code: "ACCOUNT_LINK_CONFLICT" }`として認証を失敗させ、自動統合もデータ削除も行わない。Frontend Workerはこのコールバック応答だけを`/login?oauthError=1&error=ACCOUNT_LINK_CONFLICT`へリダイレクトし、競合時に新しく発行されたセッションCookieをブラウザへ転送しない。これにより、元のゲストセッションを保持したまま別のGoogleアカウントを選び直せる。通常の引き継ぎ後はBetter Authが匿名の`user`とセッションを削除する。

`0001_curved_doctor_octopus.sql`は、導入前から存在するGoogle利用者を`auth_user_id = player_id`で`player_identity`へ登録する。これにより、導入前に作成されたDurable Object名、待機部屋、対戦、保存済みデッキも同じゲーム用PlayerIdで継続する。マイグレーションを適用せずにBackend Workerだけを先行デプロイしてはならない。

## ローカル作業

```sh
pnpm --filter @disastar/backend run auth:schema
pnpm --filter @disastar/backend run db:generate
pnpm --filter @disastar/backend run db:migrate:local
pnpm --filter @disastar/backend run test
```

Better Auth の設定やプラグインを変更した場合は、`auth:schema` で認証スキーマを更新し、差分を確認してから `db:generate` を実行する。Google OAuth の追加は既存の `user`、`account`、`session` テーブルで表現できるが、Anonymousプラグインは`user.is_anonymous`を追加するため、対応するD1マイグレーションを必ずレビューして適用する。

`.dev.vars.example`を`.dev.vars`へ複製し、32文字以上のランダムな`BETTER_AUTH_SECRET`を設定する。実際の値は commit しない。次の値は環境ごとに設定する。

| キー                          | 用途                                          | 扱い     |
| ----------------------------- | --------------------------------------------- | -------- |
| `BETTER_AUTH_SECRET`          | セッション Cookie 署名用の秘密値              | Secret   |
| `BETTER_AUTH_URL`             | クライアントから見える認証 API の公開オリジン | 環境変数 |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Cookie 付き認証リクエストを許可するオリジン   | 環境変数 |
| `GOOGLE_CLIENT_ID`            | Google OAuth クライアント ID                  | 環境変数 |
| `GOOGLE_CLIENT_SECRET`        | Google OAuth クライアント Secret              | Secret   |

`BETTER_AUTH_TRUSTED_ORIGINS`には、カンマ区切りで許可するクライアントオリジンを設定する。Frontend Workerが`/api/*`をサービスバインディングでバックエンドへ転送する構成では、`BETTER_AUTH_URL`にBackend Worker内部の名前を設定しない。

ローカルでは`BETTER_AUTH_URL`と`BETTER_AUTH_TRUSTED_ORIGINS`の両方に`http://localhost:5173`を設定する。Google callback は Frontend Worker の`/api/auth/callback/google`へ届き、そこから Backend へ転送されるため、セッション Cookie もブラウザが利用する Frontend オリジンに保存される。既存の`.dev.vars`は自動上書きされないため、メール認証から移行した開発環境ではキーを手動で置き換える。

バックエンドは`GET`と`POST`の`/api/auth/*`をBetter Authへ渡す。ゲーム、対戦待機、保存済みデッキ API は、同じ Better Auth セッション Cookie から認証利用者IDを取得し、`player_identity`で解決したゲーム用の固定`PlayerId`を使用する。既存のGoogle利用者は初回解決時に認証利用者IDと同じ`PlayerId`を保存するため、既存のDurable Object名、待機部屋、対戦、保存済みデッキを移行せずに継続できる。

`GET /api/session`はブラウザ用の最小セッション確認APIであり、`{ user: { id, name, image }, playerId, isAnonymous }`だけを返す。`image`はGoogleプロフィール画像のURLまたは`null`であり、ヘッダーとマイページのアバター表示だけに使用する。メールアドレス、OAuthトークン、Better Auth内部のセッション情報は返さない。セッションがない場合は`401 { error: { code: "UNAUTHENTICATED" } }`を返す。`/api/auth/get-session`はBetter Authの内部APIとして扱い、アプリ画面から直接利用しない。

`player_identity.auth_user_id`には外部キーを付けない。匿名利用者をGoogleアカウントへ引き継ぐ際にBetter Authが匿名の`user`行を削除しても、対応表の`playerId`と既存のゲームデータを維持するためである。アカウント引き継ぎ処理は、対応表の認証利用者IDだけを新しいGoogle利用者へ更新し、すでに別の`PlayerId`を持つGoogle利用者への自動統合は行わない。

## アカウント削除

`POST /api/auth/delete-user`を有効にし、Google利用者と匿名ゲストの両方がマイページから削除を要求できるようにする。Better Authの通常削除を使い、`user`、`account`、`session`を削除する。`account`と`session`は`user`への外部キーを`ON DELETE CASCADE`で持つ。

削除は最近認証したセッションだけで受け付ける。セッションが古くBetter Authが`400`を返した場合、フロントエンドはログアウト後にGoogleで再ログインするよう案内する。確認メールは初期ローンチでは使用しない。

`player_identity`、Durable Objectの対戦状態、待機部屋、対戦履歴、学習コンテキストは削除しない。これらは参加記録とゲーム終了後の再接続猶予の整合性のため保持する。認証利用者の対応表は残るが、削除済みの認証アカウントでは復元・参照できない。新しいGoogleログインは新しい認証利用者として扱い、過去の`PlayerId`へ自動的に再接続しない。

Better Authインスタンスは、リクエスト中のD1 Bindingと最新の環境設定から生成する。リクエスト固有のインスタンスや秘密情報をモジュールスコープへ保存しない。

## staging / production の準備

デプロイ、既存 D1 の取得、リモートマイグレーション、Google Cloud Console と Cloudflare Secrets の設定は、リポジトリ管理者が内容を確認して実行する。認可情報の値を Issue、PR、ログ、チャット、リポジトリへ貼り付けない。

1. staging と production の Frontend 公開オリジンを確定する。
2. Google Cloud Console で OAuth 2.0 の Web クライアントを作成し、各 `<origin>/api/auth/callback/google` を承認済みリダイレクト URI に追加する。
3. 環境ごとの `BETTER_AUTH_URL` と `BETTER_AUTH_TRUSTED_ORIGINS` を Frontend 公開オリジンに設定する。
4. 環境ごとの `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` を Cloudflare の Secret として設定する。
5. SQLマイグレーションをレビューし、対象環境へ適用する。`player_identity`を追加する変更では、既存データの更新や削除は行わない。`public_match_lobby`は公開待機部屋の検索候補だけを保存し、対戦の正本にはしない。
6. Backend を先にデプロイし、その後 Frontend をデプロイする。
7. 管理下の Google アカウントでログイン、ログアウト、待機部屋への戻り先、対戦画面のセッション復元、アカウント削除を手動確認する。公開部屋の作成・一覧表示・一覧からの参加、作成者の画面離脱による取消、30分後の参加拒否も確認する。匿名ゲストでの部屋作成・参加、ゲストから未使用のGoogleアカウントへの引き継ぎ、既存のGoogleアカウントを選んだ場合にゲストセッションを維持したままログイン画面へ戻ることも確認する。

## 既存 D1 の取り込み

既存 D1 にすでに手動作成済みのテーブルがある場合、最初から `db:migrate:remote` を実行してはいけない。次の環境変数をローカルだけに設定し、先に既存スキーマを取得する。

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`

```sh
pnpm --filter @disastar/backend run db:pull
```

取得結果と `src/db/schema/` を統合し、既存データを壊さないベースライン SQL を作成してレビューする。既存テーブルと今回の認証テーブルの差分が確定した後だけ、`db:migrate:remote` を実行する。

`wrangler.jsonc` の `database_id` はリポジトリだけでは確定できないためプレースホルダーである。Cloudflare 上の D1 を確認した管理者が実 ID へ置き換える。D1 の作成、リモートマイグレーション、Secrets 設定は人が内容を確認して実行する。
