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

## ルールページの図解

ルールページ(`/rule`)の各セクションは、ゲーム画面と同じFrontend Workerの`GAME_ASSETS` Bindingから、同一オリジンの`/game-assets/ui/rule-guide/`配下で図解を配信する。画像は生成時のSHA-256をオブジェクトキーへ含め、差し替え時は既存キーを上書きせず新しいキーを追加する。

| セクション             | オブジェクトキー                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| 総パワーとスタミナ     | `ui/rule-guide/goal.3d79c01916e11f614d8fbd07521014104db045d0763bb7dbbe07b46ea826571b.png`              |
| 3種類のカード          | `ui/rule-guide/cards-and-sources.af2669520a57cb08403b35c4bbc65aa41872419c9688a3d4590ee2ef921b9617.png` |
| ラウンドの流れ         | `ui/rule-guide/round-flow.06b21f01494c22df3a80f71ee0e852c17f4b41c83948466aee33604d8d6a7bd3.png`        |
| 攻撃カードの配置・連鎖 | `ui/rule-guide/attack-and-chain.ea88b6cb45a8b16e355aca87dee7baa5a5ced420a770934487d1e386e253057a.png`  |
| サポートフェーズ       | `ui/rule-guide/support.10bf0621a4f5bbb3882f8daa30e2081cb1ceb27ed40d4c1c3ac1f2f157058eaa.png`           |
| スコア計算と勝敗       | `ui/rule-guide/scoring-and-end.9825e20d1a1607031b1324d6be120086d8dd2f7d120e138ef54ec1e4054821a7.png`   |

ステージング・本番の両R2バケットへ同じキーで登録する。ブラウザへR2資格情報は渡さず、画像が取得できない場合はルール本文を表示し続ける。
