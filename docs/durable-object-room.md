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

`GameSession`の公開RPCは次の3つである。Workerは認証アダプターでプレイヤーを確定してから、HTTP API経由で`getSnapshot`と`submit`を呼び出す。標準Workerの認証アダプターは未接続のため、ゲームAPIはすべてのリクエストを拒否する。

- `initialize`: 対戦状態と初期イベントを作成して永続化する。
- `getSnapshot`: 閲覧者別の`PlayerGameView`と公開イベントを返す。未初期化時は`GAME_NOT_FOUND`、参加者外は`GAME_ACCESS_FORBIDDEN`を返す。
- `submit`: 認証済みプレイヤーのコマンドを処理し、最初の結果を`commandId`単位で保存する。未初期化・参加者外・認証済みプレイヤー不一致は安定したエラー結果で返す。

状態とコマンド結果は、応答する前にDO Storageへ書き込む。同じ`commandId`が再送された場合は、エンジンを再実行せず保存済みの最初の結果を返す。フェーズ期限がある間はDO Alarmを1つだけ設定し、アラームでは`HANDLE_PHASE_TIMEOUT`をエンジンへ渡す。

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

1. 実際の認証アダプターを接続し、`PlayerDecks`と対戦・ゲームAPIを有効化する。
2. Durable Objectのイベント保持期間と再接続時の差分取得を定義する。
3. WebSocket配信、接続休止、プレゼンスを追加する。
