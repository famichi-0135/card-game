# Frontend

React + Vite の Cloudflare Worker です。静的アセットを配信し、`/api/*` のリクエストを
`BACKEND` Service Binding で `disastar-backend` に転送します。

```sh
pnpm --filter @disastar/frontend run dev
pnpm --filter @disastar/frontend run check-types
pnpm --filter @disastar/frontend run cf-typegen
```

Binding を変更した後は `cf-typegen` を実行し、`worker-configuration.d.ts` を更新します。
