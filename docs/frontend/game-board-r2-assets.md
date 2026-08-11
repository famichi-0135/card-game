# ゲームボード R2 アセット

ゲームボードの画像は、Gitリポジトリではなく Cloudflare R2 に保存し、フロントエンド Worker が同一オリジンの `/game-assets/<key>` として配信する。

## バケットと binding

| 環境         | R2 バケット                    | Worker binding |
| ------------ | ------------------------------ | -------------- |
| 本番         | `disastar-game-assets`         | `GAME_ASSETS`  |
| ステージング | `disastar-game-assets-staging` | `GAME_ASSETS`  |

`/game-assets/*` は Worker を先に実行する。Worker は `backgrounds`、`cards`、`portraits`、`ui` の画像キーだけを受け付け、`GET` と `HEAD` 以外を拒否する。配信時は `Cache-Control: public, max-age=31536000, immutable`、`ETag`、`X-Content-Type-Options: nosniff` を付ける。

## 都市俯瞰の背景

- object key: `backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`
- content type: `image/png`
- 参照 URL: `/game-assets/backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`

画像キーは内容ハッシュを含める。画像を差し替える場合は既存キーを上書きせず、新しいキーへ切り替える。R2画像を取得できないローカル開発時は、既存の`/ui-assets/tactical-map.svg`をフォールバックとして残す。

## 初回確認

- 本番・ステージングのバケットを APAC ロケーションで作成し、同じ背景PNGを保存した。
- 本番バケットからダウンロードしたオブジェクトのSHA-256は、キーに含まれる`037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b`と一致した。
- R2 bindingを使う`wrangler dev --remote`によるブラウザ確認は、既存の`disastar-backend` WorkerがCloudflareアカウント上に存在しないため開始できなかった。背景配信のWorker境界は自動テストで確認している。
