# ゲームセッション Durable Object

## 方針

1対戦を1つの`GameSession` Durable Objectとして扱う。Workerは`gameId`から同じDOを取得し、認証済みの入力だけをRPCで渡す。ゲームルール、状態遷移、カード効果は`@disastar/game-engine`に残し、DOは状態の直列化、永続化、イベント連番、タイムアウトだけを担当する。

```text
HTTP / WebSocket Worker
        |
        | 認証済みコマンド・サーバー受信時刻
        v
GameSession Durable Object
        |
        | GameEngine API
        v
@disastar/game-engine
```

`GameSession`の公開RPCは次の3つである。Workerは Better Auth のセッションからプレイヤーを確定してから、HTTP API経由で`getSnapshot`と`submit`を呼び出す。ローカル・本番ともに認証設定が不足している場合は API を有効な利用者として扱わず、設定不備を解消する。

- `initialize`: 対戦状態と初期イベントを作成して永続化する。
- `getSnapshot`: 閲覧者別の`PlayerGameView`と公開イベントを返す。未初期化時は`GAME_NOT_FOUND`、参加者外は`GAME_ACCESS_FORBIDDEN`を返す。
- `submit`: 認証済みプレイヤーのコマンドを処理し、最初の結果を`commandId`単位で保存する。未初期化・参加者外・認証済みプレイヤー不一致は安定したエラー結果で返す。

状態とコマンド結果は、応答する前にDO Storageへ書き込む。同じ`commandId`が再送された場合は、エンジンを再実行せず保存済みの最初の結果を返す。フェーズ期限がある間はDO Alarmを1つだけ設定し、アラームでは`HANDLE_PHASE_TIMEOUT`をエンジンへ渡す。ゲーム中の公開イベントを保持し、`afterSequence`による差分取得を可能にする。

`GET /api/games/:gameId/events`は、認証済み参加者の接続だけを`GameSession.fetch`へ転送する。DOはWebSocket Hibernation APIで接続を受理し、接続ごとの`gameId`と`playerId`をattachmentとして保存する。接続・切断時には接続中の参加者 ID だけを`GAME_PRESENCE_UPDATED`として配信する。フェーズ期限に操作責任を持つプレイヤーが接続中でなければ、`HANDLE_DISCONNECT_TIMEOUT`によりそのプレイヤーを敗北にする。サポートフェーズで未終了の両者が不在なら引き分けとする。接続中なら既存の`HANDLE_PHASE_TIMEOUT`と同じフェーズ進行を行う。コマンド受理またはタイムアウト処理を永続化した後、接続中の参加者全員へ`GAME_UPDATED`（`stateVersion`と`latestEventSequence`のみ）を送る。ゲームの正規状態・公開イベント・コマンドはWebSocketで扱わず、クライアントは通知後にHTTPスナップショットを再取得する。終了後の保持期間が満了すると、接続を閉じてから状態を削除する。

ゲーム状態に記録した`RulesetVersion`、`CardCatalogVersion`、`EngineSemanticsVersion`から、対応する不変の`GameEngineContext`を解決して`initialize`、`getSnapshot`、`submit`、`alarm`を実行する。最新の固定コンテキストを進行中ゲームへ直接適用してはならない。公開カードカタログも同じ`CardCatalogVersion`から投影する。

## カタログと再接続の保持

ゲーム中に参照されるカードカタログは、`CatalogArchive` Durable Objectでリース管理する。`GameSession`は初期化時のルール、カードカタログ、エンジン意味論バージョンを保存し、そのカタログをゲームID単位でリースする。実行中のゲームのリースに期限はない。

ゲームが終了した時点のサーバー時刻から**24時間**を再接続猶予とする。この期間は次を必ず保持する。

- `GameSession`の状態、閲覧者別スナップショットに必要なイベント、同一`commandId`の結果
- ゲーム開始時のカードカタログ内容とカタログ版
- そのカタログを参照する他のゲームのリース情報

終了時に`GameSession`と`CatalogArchive`の両方へ同じ失効時刻を保存し、Durable Object Alarmで削除する。カタログは、進行中または猶予中のリースが1つでもある限り削除してはならない。最後のリースが失効した時点でカタログを削除し、同じゲームの`GameSession`も削除する。期限後のスナップショット取得は`404 GAME_NOT_FOUND`、期限後のカタログ取得は`404 CARD_CATALOG_NOT_FOUND`とする。

同一の`CardCatalogVersion`に異なる内容を登録することは、`CARD_CATALOG_VERSION_CONFLICT`として拒否する。新しいカタログを公開する際は必ず新しい版を発行し、旧版を上書きしない。

マッチング層は、信頼済みの2人のプレイヤーとデッキを`GameSession.initialize`へ渡す。`MatchLobby`はゲームIDと初期乱数seedをWeb Cryptoで生成してから、開始中の入力を永続化する。クライアント入力から`gameId`やseedを受け取らない。対戦相手の選出、参加承諾、デッキ選択の認可はマッチング・認証層の責務であり、このサービスは担当しない。詳細は[対戦待機・開始の設計](./matchmaking.md)を参照する。

## 初期カードカタログ

バックエンドは固定バージョン`initial-catalog-v2-factions`の初期カードカタログを使用する。攻撃カードは効果なし、サポートカードは基本効果を持ち、カタログ作成時に構造・陣営・参照・効果ライフサイクルを検証する。`createDisasterStarterDeckDefinitionIds`と`createCountermeasureStarterDeckDefinitionIds`は、各陣営に対して合法な30枚デッキを毎回新しい配列で返す。

陣営導入前の保存済みデッキ、待機部屋、ゲームセッションは所属陣営を復元できないため、開発段階の非互換データとして新しいDO Storageキーへ移行する。ゲームのルール・カタログ・エンジン意味バージョンも同時に更新し、旧状態へ新しい意味論を適用しない。

ID生成器は初期乱数seedをID文字列へそのまま含めない。不透明な決定的IDを使い、公開状態からseedを直接推測できないようにする。

## 次の実装

1. 実環境の2クライアントで、ブラウザの切断・復帰時にもプレゼンス表示と再同期が期待どおりか確認する。

## 統合テスト

Worker 統合テストでは、2人の Better Auth ユーザーがメール確認・ログインを完了した後、異なる陣営のスターターデッキで招待対戦を開始する。双方のWebSocket接続、相手操作による更新通知とHTTP再同期、切断・再接続時のプレゼンス通知を確認する。期限超過による敗北・引き分けの状態遷移は、実時間の待機を避けるためゲームエンジンの単体テストで決定的に確認する。
