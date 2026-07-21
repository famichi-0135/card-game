# データベース・認証基盤

## 責務

バックエンドの永続データは Cloudflare D1、スキーマとマイグレーションは Drizzle、認証は Better Auth で管理する。

- `apps/backend/src/db/schema/`: Drizzle スキーマの正本
- `apps/backend/drizzle/`: レビュー・適用する SQL マイグレーション
- `apps/backend/src/db/runtime.ts`: Workers の `env.DB` から作る実行時 Drizzle
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
