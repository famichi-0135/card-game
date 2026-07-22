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

状態とコマンド結果は、応答する前にDO Storageへ書き込む。同じ`commandId`が再送された場合は、エンジンを再実行せず保存済みの最初の結果を返す。フェーズ期限がある間はDO Alarmを1つだけ設定し、アラームでは`HANDLE_PHASE_TIMEOUT`をエンジンへ渡す。HTTP 初期実装ではゲーム中の公開イベントを保持し、`afterSequence`による差分取得を可能にする。

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

## PartyKitの評価

PartyKitはルームURL、接続管理、WebSocket配信を短く書けるため、WebSocket配信を始める段階では参考になる。ただし本プロジェクトでは直接導入しない。

- 既存のHono Worker、将来の認証、永続化の責務をPartyKitの専用CLI・デプロイ経路へ寄せる必要がある。
- この段階ではWebSocketをまだ採用せず、DOの部屋状態とエンジン連携をHTTP/RPCから検証する方針である。
- Cloudflareの現行APIでは、Durable Objectのpublic methodをWorkerからRPCで呼べる。1ゲームセッションを1つのDOに対応させるだけなら追加ライブラリは不要である。

PartyKitを採用するかは、WebSocketによるブロードキャスト、再接続、プレゼンスを実装するPRで再評価する。その際もゲーム状態の正本は`GameSession`と`@disastar/game-engine`に置く。

## 初期カードカタログ

バックエンドは固定バージョン`initial-catalog-v2-factions`の初期カードカタログを使用する。攻撃カードは効果なし、サポートカードは基本効果を持ち、カタログ作成時に構造・陣営・参照・効果ライフサイクルを検証する。`createDisasterStarterDeckDefinitionIds`と`createCountermeasureStarterDeckDefinitionIds`は、各陣営に対して合法な30枚デッキを毎回新しい配列で返す。

陣営導入前の保存済みデッキ、待機部屋、ゲームセッションは所属陣営を復元できないため、開発段階の非互換データとして新しいDO Storageキーへ移行する。ゲームのルール・カタログ・エンジン意味バージョンも同時に更新し、旧状態へ新しい意味論を適用しない。

ID生成器は初期乱数seedをID文字列へそのまま含めない。不透明な決定的IDを使い、公開状態からseedを直接推測できないようにする。

## 次の実装

1. `getAvailableGameActions` をゲームエンジンへ追加し、クライアントの操作可否判定を確定する。
2. WebSocket配信、接続休止、プレゼンスを追加する。
