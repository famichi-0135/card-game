# ゲームボード R2 アセット

ゲームボードの画像は、Gitリポジトリではなく Cloudflare R2 に保存し、フロントエンド Worker が同一オリジンの `/game-assets/<key>` として配信する。

## バケットと binding

| 環境         | R2 バケット                    | Worker binding |
| ------------ | ------------------------------ | -------------- |
| 本番         | `disastar-game-assets`         | `GAME_ASSETS`  |
| ステージング | `disastar-game-assets-staging` | `GAME_ASSETS`  |

`/game-assets/*` は Worker を先に実行する。Worker は `backgrounds`、`cards`、`portraits`、`ui` の画像キーだけを受け付け、`GET` と `HEAD` 以外を拒否する。配信時は `Cache-Control: public, max-age=31536000, immutable`、`ETag`、`X-Content-Type-Options: nosniff` を付ける。

両bindingには`remote: true`を設定する。これにより`pnpm --filter @disastar/frontend run dev`のVite開発サーバーでもWorker本体はローカル実行のままR2だけをリモート参照でき、`http://127.0.0.1:4173/games/demo`でも本番と同じ背景画像を表示できる。ゲーム画像は公開前提の読み取り専用アセットであり、開発サーバーからR2へ書き込む処理は実装しない。

Playwrightが起動する`pnpm --filter @disastar/frontend run dev:e2e`は、`CLOUDFLARE_ENV=e2e`を選ぶ。この環境では同じ`GAME_ASSETS` bindingをローカルR2に接続し、Cloudflareの資格情報や外部R2への接続を必要としない。CIでは画像取得が失敗しても既存の背景フォールバックを描画できることを確認対象とする。

## 都市俯瞰の背景

- object key: `backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`
- content type: `image/png`
- 参照 URL: `/game-assets/backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`

画像キーは内容ハッシュを含める。画像を差し替える場合は既存キーを上書きせず、新しいキーへ切り替える。R2画像を取得できないローカル開発時は、既存の`/ui-assets/tactical-map.svg`をフォールバックとして残す。

## 初回確認

- 本番・ステージングのバケットを APAC ロケーションで作成し、同じ背景PNGを保存した。
- 本番バケットからダウンロードしたオブジェクトのSHA-256は、キーに含まれる`037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b`と一致した。
- `127.0.0.1:4174`で起動したVite開発サーバーから、背景URLが`200 image/png`、immutable cache、ETagを返すことを確認した。ゲーム画面の`background-image`にも同じR2 URLが設定されている。
