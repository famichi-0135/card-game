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

`GameSession`の内部RPCは次の5つである。Workerは Better Auth のセッションからプレイヤーを確定してから、HTTP API経由で`getSnapshot`、`getLearningContext`、`submit`を呼び出す。`abandon`は`MatchLobby`の補償処理専用であり、HTTP APIとして公開しない。ローカル・本番ともに認証設定が不足している場合は API を有効な利用者として扱わず、設定不備を解消する。

- `initialize`: 対戦状態と初期イベントを作成して永続化する。
- `abandon`: `starting`の取消・期限切れに対応する初期化入力を墓標として保存し、同じゲームIDの遅延初期化を拒否してカタログリースを解放する。
- `getSnapshot`: 閲覧者別の`PlayerGameView`と公開イベントを返す。未初期化時は`GAME_NOT_FOUND`、参加者外は`GAME_ACCESS_FORBIDDEN`を返す。
- `getLearningContext`: 終了済み対戦の参加者へ、保存済みの関連カード情報を返す。進行中は`GAME_NOT_FINISHED`、未初期化・期限切れは`GAME_NOT_FOUND`、参加者外は`GAME_ACCESS_FORBIDDEN`を返す。
- `submit`: 認証済みプレイヤーのコマンドを処理し、最初の結果を`commandId`単位で保存する。`FORFEIT_GAME`は進行中の参加者からだけ受理し、送信者を敗北として終了する。未初期化・参加者外・認証済みプレイヤー不一致は安定したエラー結果で返す。

状態とコマンド結果は、応答する前にDO Storageへ書き込む。同じ`commandId`が再送された場合は、エンジンを再実行せず保存済みの最初の結果を返す。対戦中止を受理した場合も、終了状態と結果を応答前に保存する。コマンド結果は`game-command-result:<URLエンコード済みcommandId>`の個別Storageキーへ保存し、状態本体には受理・拒否を区別する索引だけを持つ。旧状態に埋め込まれた結果は、DO起動時に既存件数や個別サイズを理由に捨てず、個別キーへ移行する。受理結果は現行ルールで到達可能な全操作を覆う192件、拒否結果は128件まで保持する。各分類の上限に達した新規結果、またはJSON換算128KiBを超える結果は状態を確定せず`429 COMMAND_RESULT_CAPACITY_REACHED`を返す。拒否結果の上限は受理可能な操作へ影響せず、同じ`commandId`の既存結果をFIFO削除して冪等性を弱めてはならない。

フェーズ期限がある間はDO Alarmを1つだけ設定し、アラームでは`HANDLE_PHASE_TIMEOUT`をエンジンへ渡す。ゲーム中の公開イベントは最新から遡った連続範囲を最大1024件かつJSON換算512KiBまで保持し、`afterSequence`による差分取得を可能にする。`GameSnapshotResponse.firstAvailableEventSequence`は保持中の最古連番、イベントが空なら`latestEventSequence + 1`とする。`eventsComplete`は`afterSequence`が`firstAvailableEventSequence - 1`以上かつ最新連番以下の場合だけ`true`とし、保持範囲より古い要求と未来の要求をどちらも不完全として通知する。切詰め前に、受理済みの攻撃配置・連鎖・サポート使用を学習用実績へ累積するため、古い表示イベントを削除しても終了時の学習推薦は失われない。

DO Storageの確定後に`CatalogArchive`のリース更新またはAlarm同期だけが失敗した場合、同じ`commandId`の再送とAlarm再試行では状態遷移・イベント生成を繰り返さない。保存済みセッションを正本として、カタログリースと`GameSession` Alarmを冪等に再同期してから保存済み結果を返す。新規ゲームではカタログ全体を登録して同一バージョンの内容を検証する。保存済みゲームの再同期では`CardCatalogVersion`、ゲームID、保持期限だけでリースを更新し、対象バージョンが消失していた場合に限り保存済みカタログ全体を再登録する。`CatalogArchive`は同じカタログ、ゲームID、期限のリースが既にあればStorageを書き直さない。外部同期の完了時点で別コマンドにより状態が進んでいた場合、Alarmは常に最新セッションの期限へ合わせる。復旧完了後は同じ`stateVersion`の`GAME_UPDATED`を再送する場合があり、クライアントはこれを冪等な再同期通知として扱う。

軽量更新は`CatalogArchive.renewLease({ gameId, version, expiresAt })`で行い、カタログ本体をRPC引数へ含めない。対象版が存在しない`CARD_CATALOG_NOT_FOUND`の場合だけ、保存済みセッションのカタログを使って`retain`へフォールバックする。ただし、初回`initialize`と同一初期化入力の再送は、同じバージョンに異なる内容が登録される競合を検出するため、フルカタログの`retain`と全量比較を必ず行う。`renewLease`、`retain`、`releaseLease`は同じ値の再送を成功として扱い、内容に変更がなければStorageを書き直さない。

`MatchLobby`が`starting`を取り消すか期限切れにした場合は、`GameSession.abandon`が初期化入力と24時間後の失効時刻を先に保存する。以後のスナップショットは`GAME_NOT_FOUND`、同じゲームIDへの遅延`initialize`は失敗となる。初期化応答だけが失われて実体が作成済みだった場合も、WebSocketを閉じ、カタログリースを冪等に解放する。リース解放に失敗した場合は30秒後のAlarmで再試行し、解放済み墓標は遅延RPCを防ぐため24時間保持してから削除する。異なる初期化入力に対する破棄要求は`GAME_SESSION_CONFLICT`として受け付けない。

`GET /api/games/:gameId/events`は、認証済み参加者の接続だけを`GameSession.fetch`へ転送する。DOはWebSocket Hibernation APIで接続を受理し、接続ごとの`gameId`と`playerId`をattachmentとして保存する。接続・切断時には接続中の参加者 ID だけを`GAME_PRESENCE_UPDATED`として配信する。フェーズ期限に操作責任を持つプレイヤーが接続中でなければ、`HANDLE_DISCONNECT_TIMEOUT`によりそのプレイヤーを敗北にする。サポートフェーズで未終了の両者が不在なら引き分けとする。接続中なら既存の`HANDLE_PHASE_TIMEOUT`と同じフェーズ進行を行う。コマンド受理またはタイムアウト処理を永続化した後、接続中の参加者全員へ`GAME_UPDATED`（`stateVersion`と`latestEventSequence`のみ）を送る。ゲームの正規状態・公開イベント・コマンドはWebSocketで扱わず、クライアントは通知後にHTTPスナップショットを再取得する。終了後の保持期間が満了すると、接続を閉じてから状態を削除する。

ゲーム状態に記録した`RulesetVersion`、`CardCatalogVersion`、`EngineSemanticsVersion`から、対応する不変の`GameEngineContext`を解決して`initialize`、`getSnapshot`、`submit`、`alarm`を実行する。最新の固定コンテキストを進行中ゲームへ直接適用してはならない。公開カードカタログも同じ`CardCatalogVersion`から投影する。

## カタログと再接続の保持

ゲーム中に参照されるカードカタログは、`CatalogArchive` Durable Objectでリース管理する。`GameSession`は初期化時のルール、カードカタログ、エンジン意味論バージョンを保存し、そのカタログをゲームID単位でリースする。実行中のゲームのリースに期限はない。

ゲームが終了した時点のサーバー時刻から**24時間**を再接続猶予とする。この期間は次を必ず保持する。

- `GameSession`の状態、上限内の閲覧者別イベント、同一`commandId`の保存済み結果
- ゲーム開始時のカードカタログ内容とカタログ版
- 対戦終了時に生成した学習コンテキスト。関連カードが0件でも空のコンテキストを保存する
- そのカタログを参照する他のゲームのリース情報

終了時に`GameSession`と`CatalogArchive`の両方へ同じ失効時刻を保存し、Durable Object Alarmで削除する。カタログは、進行中または猶予中のリースが1つでもある限り削除してはならない。最後のリースが失効した時点でカタログを削除し、同じゲームの`GameSession`も削除する。期限後のスナップショット取得は`404 GAME_NOT_FOUND`、期限後のカタログ取得は`404 CARD_CATALOG_NOT_FOUND`とする。

学習コンテキストの作成対象は、受理済みの攻撃配置、連鎖、サポート使用イベントだけとする。各参加者について、公開済み学習記事に関連するカードをイベント連番の新しい順に重複なく最大2種類選ぶ。表示用では両者の選択結果をカード定義ID単位で統合する。記事対応の正本は`@disastar/learning-content`であり、将来のD1移行やRepository抽象化は初期実装に含めない。

同一の`CardCatalogVersion`に異なる内容を登録することは、`CARD_CATALOG_VERSION_CONFLICT`として拒否する。新しいカタログを公開する際は必ず新しい版を発行し、旧版を上書きしない。

マッチング層は、信頼済みの2人のプレイヤーとデッキを`GameSession.initialize`へ渡す。`MatchLobby`はゲームIDと初期乱数seedをWeb Cryptoで生成してから、開始中の入力を永続化する。クライアント入力から`gameId`やseedを受け取らない。対戦相手の選出、参加承諾、デッキ選択の認可はマッチング・認証層の責務であり、このサービスは担当しない。詳細は[対戦待機・開始の設計](./matchmaking.md)を参照する。

## 初期カードカタログ

バックエンドは固定バージョン`initial-catalog-v5-learning-content`の初期カードカタログを使用する。攻撃カードは効果なし、サポートカードは基本効果を持ち、カタログ作成時に構造・陣営・参照・効果ライフサイクルを検証する。`createDisasterStarterDeckDefinitionIds`と`createCountermeasureStarterDeckDefinitionIds`は、各陣営に対して合法な30枚デッキを毎回新しい配列で返す。カード名と学習解説を更新しても、開始済みゲームは保存済みのカタログ内容を使用し続ける。

陣営導入前の保存済みデッキ、待機部屋、ゲームセッションは所属陣営を復元できないため、開発段階の非互換データとして新しいDO Storageキーへ移行する。ゲームのルール・カタログ・エンジン意味バージョンも同時に更新し、旧状態へ新しい意味論を適用しない。

ID生成器は初期乱数seedをID文字列へそのまま含めない。不透明な決定的IDを使い、公開状態からseedを直接推測できないようにする。

## 次の実装

1. 実環境の2クライアントで、ブラウザの切断・復帰時にもプレゼンス表示と再同期が期待どおりか確認する。

## 統合テスト

Worker 統合テストでは、Google OAuthまたは匿名ゲストで作成された Better Auth セッションを2人分用意し、異なる陣営のスターターデッキで招待対戦を開始する。Google の実アカウントを使う認可・callback、匿名ゲストの部屋作成・参加、ゲストからGoogleへの引き継ぎは staging で手動確認する。双方のWebSocket接続、相手操作による更新通知とHTTP再同期、切断・再接続時のプレゼンス通知を確認する。期限超過による敗北・引き分けの状態遷移は、実時間の待機を避けるためゲームエンジンの単体テストで決定的に確認する。
