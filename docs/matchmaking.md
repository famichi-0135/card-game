# 対戦待機・開始の設計

## 目的

本書は、認証済みの2人が対戦を開始するまでの責務を定義する。ゲームルールや対戦中の状態は`GameSession`と`@disastar/game-engine`の責務であり、対戦待機はそれらを初期化する前段の調整だけを担う。

初期実装は、URLを知る相手を招待する2人用の`MatchLobby` Durable Objectとする。公開対戦一覧、ランダムマッチ、観戦は含めない。

```text
認証アダプター
       |
       | 確定済みPlayerId・認可済みデッキ
       v
MatchLobby Durable Object
       |
       | InitializeGameInput
       v
GameSession Durable Object -> @disastar/game-engine
```

## 状態遷移

| 状態        | 意味                                      | 許可する操作             |
| ----------- | ----------------------------------------- | ------------------------ |
| `waiting`   | 作成者が相手の参加を待つ                  | 相手の参加、作成者の取消 |
| `starting`  | `GameSession`初期化を再開可能な形で処理中 | 同じ参加者による再送     |
| `started`   | `GameSession`の初期化済み                 | 対戦画面へ遷移           |
| `cancelled` | 作成者が待機を取り消した                  | なし                     |

参加時は、まず`starting`と使用する`gameId`・乱数seed・両デッキをDO Storageへ確定する。その後に`GameSession.initialize`を呼び、成功した場合だけ`started`へ遷移する。同じ初期化入力に対する`GameSession.initialize`は成功として扱うため、`starting`の途中でDOが再起動しても同じ参加者の再送で開始処理を再開できる。

ゲーム作成がデッキ検証などで失敗した場合は`waiting`へ戻す。失敗した参加者のデッキは保存せず、作成者は別の相手の参加を受け付けられる。

## 信頼境界

- `MatchLobby`のRPCには、将来のWorker認証アダプターが確定した`PlayerId`だけを渡す。クライアントが主張する`PlayerId`は使用しない。
- デッキは所有者の保存済みデッキを認可してから渡す。クライアントが任意のカードID配列を送る公開APIは作らない。
- `MatchLobbyView`は参加者だけに返し、デッキ内容、乱数seed、開始中の内部入力を含めない。
- `gameId`は`started`後にだけ返す。`MatchLobby`のDO IDは推測不可能な`newUniqueId()`で生成し、招待URLの識別子として扱う。

## 永続化の分担

`MatchLobby`は短命な招待・参加・開始の直列化を担当する。将来D1を導入する場合は、ユーザー、所有デッキ、対戦履歴、公開対戦の検索インデックスを保存する。D1を待機部屋の正本にしないため、参加の競合やゲーム開始の二重実行を複数のWorkerリクエストで調停する必要がない。

認証プロバイダー、デッキCRUD、招待URLのHTTP API、待機期限、D1のスキーマは後続の実装で確定する。
