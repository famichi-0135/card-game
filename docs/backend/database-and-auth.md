# データベース・認証基盤

## 責務

バックエンドの永続データは Cloudflare D1、スキーマとマイグレーションは Drizzle、認証は Better Auth を使用する。初期ローンチの認証プロバイダーは **Google OAuth のみ** とし、メール・パスワード認証、確認メール、パスワード再設定、Cloudflare Email Service は使用しない。

- `apps/backend/src/db/schema/`: Drizzle スキーマの正本
- `apps/backend/drizzle/`: レビュー・適用する SQL マイグレーション
- `apps/backend/src/db/runtime.ts`: Workers の `env.DB` から作る実行時 Drizzle
- `apps/backend/src/auth/create-auth.ts`: Google OAuth を含む Better Auth 設定
- `apps/backend/src/auth/runtime-auth.ts`: リクエストごとの Better Auth 生成とセッション認証
- `apps/backend/src/db/migration.ts`: Better Auth CLI がスキーマを検査するための Drizzle
- `apps/backend/auth.cli.ts`: Better Auth CLI 専用設定
- `apps/backend/drizzle.config.ts`: Drizzle Kit 専用設定

CLI 用の疑似 D1 クライアントを Workers のリクエスト処理へ持ち込まない。実行時はリクエストの `CloudflareBindings.DB` から Drizzle を作る。

## Google OAuth の運用仕様

ログイン画面は `POST /api/auth/sign-in/social` に `provider: "google"` を送信し、Better Auth が返す認可 URL へブラウザを遷移させる。初回ログイン時は Better Auth が Google の subject を `account` テーブルへ保存し、以後は同じ Google アカウントを同じアプリ利用者として扱う。

要求するスコープは `openid`、`email`、`profile` だけとする。Google API の操作権限やオフラインアクセスは要求しない。Google から検証済みとして返るメールアドレスと表示名、プロフィール画像だけを利用者情報として保存する。

`BETTER_AUTH_URL`は、ブラウザから到達できる Frontend Worker の公開オリジンである。Better Auth の Google callback URI は次の形で固定する。

```text
<BETTER_AUTH_URL>/api/auth/callback/google
```

ローカル、staging、production の URI は Google Cloud Console の OAuth 2.0 クライアントに個別に完全一致で登録する。staging と production の公開 URL は、デプロイ前に管理者が確定してから追加する。ワイルドカード、Backend Worker の内部名、未管理のプレビュー URL は登録しない。

Google OAuth に失敗した場合、フロントエンドは認可エラーを表示してログイン画面へ留まる。対戦画面と待機部屋へ未ログインでアクセスした場合は、同一オリジン内に限定して検証した `returnTo` を付けて `/login` へ移動する。認証成功後はその URL へ戻る。

## ローカル作業

```sh
pnpm --filter @disastar/backend run auth:schema
pnpm --filter @disastar/backend run db:generate
pnpm --filter @disastar/backend run db:migrate:local
pnpm --filter @disastar/backend run test
```

Better Auth の設定やプラグインを変更した場合は、`auth:schema` で認証スキーマを更新し、差分を確認してから `db:generate` を実行する。Google OAuth の追加は既存の `user`、`account`、`session` テーブルで表現できるため、想定どおり差分がなければ新しい D1 マイグレーションは作成しない。

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

バックエンドは`GET`と`POST`の`/api/auth/*`をBetter Authへ渡す。ゲーム、対戦待機、保存済みデッキ API は、同じ Better Auth セッション Cookie からユーザー ID を取得し、`PlayerId`として使用する。セッションがない場合は`401 UNAUTHENTICATED`を返し、D1障害や認証設定不備を未認証として扱わない。

Better Authインスタンスは、リクエスト中のD1 Bindingと最新の環境設定から生成する。リクエスト固有のインスタンスや秘密情報をモジュールスコープへ保存しない。

## staging / production の準備

デプロイ、既存 D1 の取得、リモートマイグレーション、Google Cloud Console と Cloudflare Secrets の設定は、リポジトリ管理者が内容を確認して実行する。認可情報の値を Issue、PR、ログ、チャット、リポジトリへ貼り付けない。

1. staging と production の Frontend 公開オリジンを確定する。
2. Google Cloud Console で OAuth 2.0 の Web クライアントを作成し、各 `<origin>/api/auth/callback/google` を承認済みリダイレクト URI に追加する。
3. 環境ごとの `BETTER_AUTH_URL` と `BETTER_AUTH_TRUSTED_ORIGINS` を Frontend 公開オリジンに設定する。
4. 環境ごとの `BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` を Cloudflare の Secret として設定する。
5. Backend を先にデプロイし、その後 Frontend をデプロイする。
6. 管理下の Google アカウントでログイン、ログアウト、待機部屋への戻り先、対戦画面のセッション復元を手動確認する。

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
