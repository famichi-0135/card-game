# Backend

Hono を使う Cloudflare API Worker です。Frontend Worker から `BACKEND` Service Binding
経由で呼び出されます。

```sh
pnpm --filter @disastar/backend run dev
pnpm --filter @disastar/backend run check-types
pnpm --filter @disastar/backend run build
pnpm --filter @disastar/backend run deploy
```

現在の疎通確認エンドポイントは `GET /api/health` です。API の request / response 型は
`@disastar/contracts` に追加します。
