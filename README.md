# Disastar Card Game

Cloudflare Workers と React を使うカードゲーム用の pnpm / Turborepo モノレポです。

## Workspace

- `apps/frontend`: React + Vite のフロントエンド Worker。`/api/*` を Backend へ Service Binding 経由で委譲します。
- `apps/backend`: Hono を使う API Worker。
- `packages/contracts`: Frontend と Backend が共有する API 契約。
- `packages/ui`: 共有 UI コンポーネント。
- `packages/eslint-config`: 共通 ESLint flat config。
- `packages/typescript-config`: 共通 TypeScript config。

## Requirements

- Node.js 26
- pnpm 11

## Commands

```sh
pnpm install
pnpm run dev
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run build
```

`pnpm run dev` は Frontend と Backend を同時に起動します。Frontend は
`http://localhost:5173`、Backend は `http://127.0.0.1:8787` で待ち受けます。

```sh
curl http://localhost:5173/api/health
# {"status":"ok"}
```

Cloudflare Binding の設定を変更した場合は、Frontend の型を再生成します。

```sh
pnpm --filter @disastar/frontend run cf-typegen
```

本番では Backend を先に deploy し、Frontend が `BACKEND` Service Binding を通じて
`disastar-backend` を呼び出します。
# card-game
