# Backend

Hono を使う Cloudflare API Worker です。Frontend Worker から `BACKEND` Service Binding
経由で呼び出されます。

```sh
pnpm --filter @disastar/backend run dev
pnpm --filter @disastar/backend run check-types
pnpm --filter @disastar/backend run build
pnpm --filter @disastar/backend run deploy
```

`dev`は初回起動時に`.dev.vars.example`からローカル専用の`.dev.vars`を生成し、
D1のローカルマイグレーションを適用してからWorkerを起動します。生成するBetter Authの
secretはローカル専用であり、値を標準出力へ表示しません。既存の`.dev.vars`がある場合は
読み取りも上書きも行いません。

`.dev.vars`はGit管理対象外です。本番環境のsecretや変数は、このファイルを流用せず
Cloudflare側で設定してください。

Wranglerのローカル実行ではCloudflare Edgeが付与する`CF-Connecting-IP`が存在しないため、
Better AuthがクライアントIPを判定できないという警告が出る場合があります。本番では
`CF-Connecting-IP`だけを信頼する設定です。警告を消す目的で、クライアントが偽装できる
任意の転送ヘッダーを信頼対象へ追加しないでください。

現在の疎通確認エンドポイントは `GET /api/health` です。API の request / response 型は
`@disastar/contracts` に追加します。
