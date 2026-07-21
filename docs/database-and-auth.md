# データベース・認証基盤

## 責務

バックエンドの永続データは Cloudflare D1、スキーマとマイグレーションは Drizzle、認証は Better Auth、認証用トランザクションメールは Cloudflare Email Service で管理する。

- `apps/backend/src/db/schema/`: Drizzle スキーマの正本
- `apps/backend/drizzle/`: レビュー・適用する SQL マイグレーション
- `apps/backend/src/db/runtime.ts`: Workers の `env.DB` から作る実行時 Drizzle
- `apps/backend/src/auth/runtime-auth.ts`: リクエストごとの Better Auth 生成とセッション認証
- `apps/backend/src/auth/auth-email-service.ts`: 認証メールの用途と本文生成
- `apps/backend/src/email/`: 交換可能なトランザクションメール送信境界と Cloudflare アダプター
- `apps/backend/src/db/migration.ts`: Better Auth CLI がスキーマを検査するための Drizzle
- `apps/backend/auth.cli.ts`: Better Auth CLI 専用設定
- `apps/backend/drizzle.config.ts`: Drizzle Kit 専用設定

CLI 用の疑似 D1 クライアントを Workers のリクエスト処理へ持ち込まない。実行時はリクエストの `CloudflareBindings.DB` から Drizzle を作る。

## ローカル作業

```sh
pnpm --filter @disastar/backend run auth:schema
pnpm --filter @disastar/backend run db:generate
pnpm --filter @disastar/backend run db:migrate:local
pnpm --filter @disastar/backend run test
```

Better Auth の設定やプラグインを変更した場合は、`auth:schema` で認証スキーマを更新し、差分を確認してから `db:generate` を実行する。生成された TypeScript と SQL は commit する。

`.dev.vars.example`を`.dev.vars`へ複製し、32文字以上のランダムな`BETTER_AUTH_SECRET`を設定する。実際の値は commit しない。

`BETTER_AUTH_URL`にはクライアントから見える認証APIの公開オリジンを設定する。フロントエンドWorkerが`/api/*`をサービスバインディングでバックエンドへ転送する本番構成では、バックエンドWorker内部の名前ではなくフロントエンドの公開オリジンを指定する。`BETTER_AUTH_TRUSTED_ORIGINS`には、カンマ区切りで許可するクライアントオリジンを設定する。

`AUTH_EMAIL_FROM`にはCloudflare Email Serviceで有効化したドメインの送信元アドレスを設定する。`AUTH_EMAIL_FROM_NAME`は任意で、未設定時は`Disastar Card Game`になる。`wrangler.jsonc`の`allowed_sender_addresses`も同じ実アドレスへ置き換え、Bindingから別の送信元を使用できないようにする。

バックエンドは`GET`と`POST`の`/api/auth/*`をBetter Authへ渡す。ゲーム、対戦待機、保存済みデッキAPIは、同じBetter AuthセッションCookieからユーザーIDを取得し、`PlayerId`として使用する。セッションがない場合は`401 UNAUTHENTICATED`を返し、D1障害や認証設定不備を未認証として扱わない。

Better Authインスタンスは、リクエスト中のD1 Bindingと最新の環境設定から生成する。リクエスト固有のインスタンスや秘密情報をモジュールスコープへ保存しない。

## メール確認とパスワード再設定

メールとパスワードによる登録では、登録直後にセッションを発行せず、確認メール内のリンクを開いた後だけログインを許可する。確認トークンの有効期間は1時間である。未確認ユーザーがログインを試みた場合も確認メールを再送する。

パスワード再設定はBetter Authの`request-password-reset`と`reset-password`を使用する。再設定トークンの有効期間は30分で、再設定が成功した時点で既存セッションをすべて失効させる。存在しないメールアドレスを外部から判別できないよう、独自の検索APIや異なる成功メッセージを追加しない。

メール送信はHonoから受け取ったCloudflare Workersの`executionCtx.waitUntil`へ登録し、HTTPレスポンスを不必要に遅延させない。メール本文はHTMLとプレーンテキストの両方を生成し、ユーザー名と操作URLはHTMLエスケープする。

## Cloudflare Email Serviceの準備

Cloudflare Email ServiceのWorkers Bindingを使用するため、APIキーは不要である。一方、任意のユーザー宛て送信はPublic Beta期間中でWorkers Paidプランが必要である。Email Serviceが要件を満たさなくなった場合は、`TransactionalEmailSender`の実装だけを別サービスへ交換し、Better Auth設定は維持する。

本番送信前に、リポジトリ管理者がCloudflare DNSで管理する送信ドメインをEmail Serviceへ登録する。

```sh
pnpm --filter @disastar/backend exec wrangler email sending list
pnpm --filter @disastar/backend exec wrangler email sending enable example.com
```

登録により追加されるSPF、DKIM、DMARCなどのDNS設定をCloudflare Dashboardで確認する。その後、次の2か所に同じ送信元を設定する。

- 本番Workerの`AUTH_EMAIL_FROM`
- `apps/backend/wrangler.jsonc`の`allowed_sender_addresses`

ローカル環境ではEmail Service Bindingが送信内容をシミュレートする。このリポジトリでは、開発中の誤送信を避けるため`remote: true`を設定しない。実配送テストを行う場合だけ、管理者が実在する管理下の宛先を使い、Cloudflareの送信ログと抑制リストを確認する。

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
