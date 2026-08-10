# 対戦待機・開始の設計

## 目的

本書は、認証済みの2人が対戦を開始するまでの責務を定義する。ゲームルールや対戦中の状態は`GameSession`と`@disastar/game-engine`の責務であり、対戦待機はそれらを初期化する前段の調整だけを担う。

初期実装は2人用の`MatchLobby` Durable Objectとする。作成者は招待URL専用の`invite`と、認証済み利用者の部屋一覧に表示する`public`を選択できる。ランダムマッチと観戦は含めない。

```text
認証アダプター
       |
       | 確定済みPlayerId
       v
PlayerDecks Durable Object
       |
       | 所有者限定の保存済みデッキ・現在のルールでの再検証
       v
MatchLobby Durable Object
       |
       | InitializeGameInput
       v
GameSession Durable Object -> @disastar/game-engine
```

## 状態遷移

| 状態        | 意味                                      | 許可する操作               |
| ----------- | ----------------------------------------- | -------------------------- |
| `waiting`   | 作成者が相手の参加を待つ                  | 相手の参加、作成者の取消   |
| `starting`  | `GameSession`初期化を再開可能な形で処理中 | 参加者の再送、作成者の取消 |
| `started`   | `GameSession`の初期化済み                 | 対戦画面へ遷移             |
| `cancelled` | 作成者の取消または待機期限切れ            | なし                       |

参加時は、作成者と参加者の保存済みデッキが異なる陣営であることを確認する。次に`starting`と使用する`gameId`・乱数seed・両プレイヤーの陣営・両デッキをDO Storageへ確定する。その後に`GameSession.initialize`を呼び、成功した場合だけ`started`へ遷移する。同じ初期化入力に対する`GameSession.initialize`は成功として扱うため、`starting`の途中でDOが再起動するなど結果を確定できなかった場合は、同じ参加者の再送で開始処理を再開できる。

ゲーム作成がデッキ検証などの明示的なエラー結果で失敗した場合は、元の作成時刻・待機期限・公開範囲を維持して`waiting`へ戻す。失敗した参加者のID、陣営、デッキ、生成済み`gameId`と乱数seedは待機状態へ残さず、作成者は別の相手の参加を受け付けられる。

`GameSession.initialize`のRPC例外は、初期化前の失敗と、相手側では初期化済みだが応答だけ失われた状態を区別できない。この場合は`starting`と同じ`gameId`・乱数seed・参加者を保持し、同じ参加者だけが同一入力で再試行できるようにする。公開一覧には戻さず、別の参加者は受け付けない。待機画面では参加者に「対戦開始を再試行する」、作成者に「招待部屋を取り消す」を表示する。RPC例外の内部情報は利用者へ公開せず、既存の`GAME_CREATION_FAILED`を返す。

外部RPCの待機中は同じ開始処理が再送される可能性がある。完了時は保存済みの`starting.gameInput.gameId`が現在の開始試行と一致する場合だけ状態を更新し、古い成功・失敗結果で新しい参加や`started`を上書きしない。同じ試行がすでに`started`になっている場合は、その確定済み`gameId`を成功として返す。

待機期限は作成から30分とする。期限は`waiting`と`starting`の両方へ適用し、開始処理中に期限を過ぎた場合も`started`へ進めず`cancelled`へ遷移する。作成者が待機画面を離れたとき、クライアントは取消を直ちに試行する。タブ終了や通信断では送信が保証されないため、`MatchLobby`のAlarmと各操作時の期限検査で最終的に`cancelled`へ遷移させる。単にタブが非表示になっただけでは取り消さない。

`starting`を取り消す場合は、`MatchLobby`が`cancelled`と破棄対象の初期化入力を先に保存し、参加再送を受け付けない状態へしてから`GameSession.abandon`を呼ぶ。これにより、初期化成功後の応答だけが失われた場合も孤立したゲームを参照不能にし、カタログリースを解放できる。`GameSession`への破棄RPCが失敗した間は破棄対象を残し、30秒後のAlarmで再試行する。`GameSession`側も破棄墓標を24時間保持して遅延`initialize`を拒否し、リース解放に失敗した場合は30秒後のAlarmで再試行する。`GameSession`が破棄要求を受理した後にだけ`MatchLobby`の破棄対象とAlarmを消去する。期限切れの`starting`にも同じ補償処理を適用する。

## 信頼境界

- `MatchLobby`のRPCには、将来のWorker認証アダプターが確定した`PlayerId`だけを渡す。クライアントが主張する`PlayerId`は使用しない。
- デッキは所有者の保存済みデッキを認可し、保存された`Faction`とカード定義ID配列を一体で渡す。クライアントが対戦参加時に任意の陣営やカードID配列を送る公開APIは作らない。
- 待機中の`MatchLobbyView`は、招待URLまたは部屋IDを知る認証済み利用者に返す。開始・取消後は参加者だけに返し、デッキ内容、乱数seed、開始中の内部入力を含めない。
- 公開一覧は専用の`PublicMatchLobbySummary`を返し、作成者の表示名、メールアドレス、`PlayerId`、デッキ内容を含めない。
- `gameId`は`started`後にだけ返す。`MatchLobby`のDO IDは推測不可能な`newUniqueId()`で生成し、招待URLの識別子として扱う。

## 永続化の分担

`MatchLobby`は短命な招待・参加・開始の直列化を担当する。`PlayerDecks`は認証済み`PlayerId`を名前として1プレイヤーにつき1つ取得し、そのプレイヤーの保存済みデッキだけをDO Storageへ保存する。デッキの一覧・更新・削除は同じDO内で直列化され、他プレイヤーのデッキを参照できない。

対戦作成・参加時は、`PlayerDecks`から取得したデッキを現在のカードカタログとゲームルールで再検証する。削除済み、またはカードカタログ更新で違法になったデッキは`MatchLobby`へ渡さない。

公開待機部屋だけをD1の`public_match_lobby`検索インデックスへ保存する。D1は`matchId`、作成者の`PlayerId`、作成陣営、作成時刻、期限だけを保持し、公開APIには作成者の`PlayerId`を返さない。期限切れ行は一覧取得時に削除する。

D1を待機部屋の正本にしない。`GET /api/matches`はD1の候補を得た後に各`MatchLobby`へ公開状態を再確認する。`waiting`だけを応答へ含め、`starting`は一時的に非表示にするが、同じ参加者の再試行または作成者の取消が完了するまで索引行を削除しない。`started`、`cancelled`、期限切れ、DO不存在、索引との不整合は終端または無効な候補として索引から削除する。参加成功・作成者取消のHTTP応答時にも索引行を削除する。参加競合やゲーム開始の二重実行は常に`MatchLobby`が直列化する。

## HTTP境界

`POST /api/matches`、`GET /api/matches`、`GET /api/matches/:matchId`、`POST /api/matches/:matchId/accept`、`POST /api/matches/:matchId/cancel`のHTTPアダプターを用意する。作成本文は保存済みデッキを選ぶ`deckId`と公開範囲`visibility`だけ、参加本文は`deckId`だけであり、`PlayerId`、`Faction`、カード定義ID配列は含めない。`visibility`未指定は既存招待URLとの互換性のため`invite`とする。

| 操作             | エンドポイント                      | クライアント本文          | 成功時の応答                             |
| ---------------- | ----------------------------------- | ------------------------- | ---------------------------------------- |
| 対戦作成         | `POST /api/matches`                 | `{ deckId, visibility? }` | `201 { matchId }`                        |
| 公開部屋一覧取得 | `GET /api/matches`                  | なし                      | `{ matches: PublicMatchLobbySummary[] }` |
| 対戦取得         | `GET /api/matches/:matchId`         | なし                      | `{ match: MatchLobbyView }`              |
| 対戦参加         | `POST /api/matches/:matchId/accept` | `{ deckId }`              | `{ accepted: true, gameId }`             |
| 対戦取消         | `POST /api/matches/:matchId/cancel` | なし                      | `{ cancelled: true }`                    |

保存済みデッキは次のHTTPアダプターで操作する。本文の`cardDefinitionIds`は現在のゲームルールで検証し、違法なデッキは保存しない。すべての操作は認証済みプレイヤー自身の`PlayerDecks`だけを対象にする。

| 操作                 | エンドポイント              | クライアント本文                       |
| -------------------- | --------------------------- | -------------------------------------- |
| 一覧取得             | `GET /api/decks`            | なし                                   |
| 作成                 | `POST /api/decks`           | `{ name, faction, cardDefinitionIds }` |
| スターターデッキ作成 | `POST /api/decks/starter`   | `{ faction }`                          |
| 取得                 | `GET /api/decks/:deckId`    | なし                                   |
| 置換                 | `PUT /api/decks/:deckId`    | `{ name, faction, cardDefinitionIds }` |
| 削除                 | `DELETE /api/decks/:deckId` | なし                                   |

スターターデッキ作成は、クライアントがカード定義ID配列を指定せず、Workerが現在のカードカタログの正規30枚構成を生成する。初期ローンチのフロントエンドはロール選択時にこのスターターデッキだけを自動作成・利用し、カード単位の編集や任意の保存済みデッキ選択を提供しない。

スターター構成を更新した後に旧構成の同名デッキが保存されていても、Workerは既存デッキを上書きせず、現行構成のスターターデッキを新規作成する。ロール選択では新規作成した現行デッキを使用する。

対戦アダプターは認証済み`PlayerId`と`deckId`から、所有権確認済みかつ現在も有効な陣営・カード定義ID配列を解決してから`MatchLobby`を呼ぶ。標準WorkerはBetter AuthのセッションからプレイヤーIDを確定する。

公開部屋一覧は作成日時の新しい順に最大20件を返す。WebSocketは使わず、クライアントは5秒ごとのポーリングと手動更新で一覧を更新する。部屋選択後は既存の待機画面で陣営を確認してから参加を確定する。
