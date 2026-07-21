# クライアント・サーバー通信境界

## 目的

本書は、ゲームエンジンとクライアント・バックエンドの責務境界を定義する。HTTPとBetter Authによる現在の通信境界を定め、WebSocket、公開マッチング、観戦の具体方式は後続実装で決定する。

依存方向は次に固定する。

```text
@disastar/game-engine/contracts
            ↑
@disastar/contracts
            ↑
apps/backend, apps/frontend
```

`@disastar/game-engine`はゲームルール、状態遷移、カード効果の正本であり、通信やインフラストラクチャへ依存しない。`@disastar/contracts`は通信DTOだけを定義し、ゲーム状態やカード効果を再定義しない。

## クライアントから送る操作

クライアントは`SubmitGameCommandRequest`を送る。操作本体の`GameCommand`は次を必ず含む。

| 項目                 | 用途                                                     |
| -------------------- | -------------------------------------------------------- |
| `commandId`          | 再送を含む同一操作の識別子                               |
| `gameId`             | 対象の対戦                                               |
| `playerId`           | 操作したプレイヤーとしてクライアントが主張する値         |
| `phaseSequence`      | 操作対象フェーズの世代。現在状態との完全一致が必要       |
| `clientStateVersion` | 操作作成時に観測した状態。古いことだけでは拒否しない     |
| `issuedAt`           | クライアント時刻。表示・診断用で、ゲーム判定には使わない |

カード対象はカード定義IDではなくカードインスタンスIDで指定する。複合効果の対象は`EffectInput`を効果ID単位で送る。

バックエンドは、JSON本文を`GameCommand`として型アサーションしない。`@disastar/game-engine`の`parseGameCommand`で実行時検証してから扱う。未知フィールド、空の識別子、負の世代番号、有限でない数値、JSON値ではない`parameters`を含む入力は、認証やゲーム状態の検証より前に拒否する。

## バックエンドが付与する情報

バックエンドはクライアント入力をそのままエンジンへ渡さない。認証と対戦参加者の照合後、次を付与した`AuthenticatedGameCommand`を作る。

| 項目                    | 用途                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `authenticatedPlayerId` | 認証基盤が確定したプレイヤー。`command.playerId`と一致しなければ拒否する |
| `receivedAt`            | バックエンドが受信した信頼済み時刻。期限判定とイベント時刻の基準         |

`receivedAt`はクライアントから受け取らない。対戦単位でコマンドを直列化し、同じ`commandId`には保存済みの最初の結果を再送する。

## バックエンドから返す情報

操作結果は`SubmitGameCommandResponse`で返す。

- 受理時は、確定後の`PlayerGameView`と閲覧者向けに投影済みの`PlayerVisibleEventEnvelope[]`を返す。
- 拒否時は、安定した`GameCommandError`と現在の`PlayerGameView`を返す。
- 再接続時、またはイベント連番の欠落時は、`GameSnapshotResponse`を返す。

`PlayerGameView`と公開イベントには、相手の手札、山札内容と順番、初期乱数seed、内部カード効果設定を含めない。`CARDS_DRAWN`イベントは本人にはカードID、相手には枚数だけを公開する。

## HTTP アダプター

バックエンドはBetter AuthのセッションCookieからユーザーIDを取得し、`PlayerId`として次のHTTPアダプターへ渡す。セッションがない場合は`401 UNAUTHENTICATED`で拒否する。テストでは認証アダプターを差し替えられるが、標準WorkerはBetter Authを使用する。

| 操作                 | エンドポイント                                  | 成功時の応答                |
| -------------------- | ----------------------------------------------- | --------------------------- |
| スナップショット取得 | `GET /api/games/:gameId?afterSequence=<number>` | `GameSnapshotResponse`      |
| コマンド送信         | `POST /api/games/:gameId/commands`              | `SubmitGameCommandResponse` |

HTTPアダプターは、認証後かつDO呼び出し前にJSON本文と`afterSequence`を検証する。本文の`gameId`がパスと異なる場合は`400 GAME_ID_MISMATCH`、本文の`playerId`が認証結果と異なる場合は`403 AUTHENTICATED_PLAYER_MISMATCH`で拒否する。ゲームルール上の拒否は通信エラーではないため、`SubmitGameCommandResponse`の`accepted: false`を`200`で返す。

未初期化または存在しないゲームは`404 GAME_NOT_FOUND`、認証済みプレイヤーがそのゲームの参加者でない場合は`403 GAME_ACCESS_FORBIDDEN`を返す。Durable Object内部の未初期化・参加者外アクセスを例外のままHTTP応答へ流さない。

## 対戦待機

招待式の対戦待機は`MatchLobby` Durable Objectで直列化する。HTTPアダプターはBetter Authの認証結果からプレイヤーを決定し、保存済みデッキを所有権確認してから待機部屋へ渡す。クライアント本文のプレイヤーIDやカード定義ID配列は信用しない。

| 操作     | エンドポイント                      | クライアント本文 | 成功時の応答                 |
| -------- | ----------------------------------- | ---------------- | ---------------------------- |
| 対戦作成 | `POST /api/matches`                 | `{ deckId }`     | `201 { matchId }`            |
| 対戦取得 | `GET /api/matches/:matchId`         | なし             | `{ match: MatchLobbyView }`  |
| 対戦参加 | `POST /api/matches/:matchId/accept` | `{ deckId }`     | `{ accepted: true, gameId }` |
| 対戦取消 | `POST /api/matches/:matchId/cancel` | なし             | `{ cancelled: true }`        |

`MatchLobby`の公開状態にデッキ、乱数seed、開始中のゲーム初期化入力を含めない。状態遷移の詳細は[対戦待機・開始の設計](./matchmaking.md)を参照する。

## 保存済みデッキ

保存済みデッキは認証済みプレイヤー本人だけが操作できる。リクエスト本文に`playerId`を含めず、Workerが認証結果から対象の`PlayerDecks`を決定する。`cardDefinitionIds`は作成・置換時に現在のカードカタログとゲームルールで検証し、違法な構成は`422 DECK_VALIDATION_FAILED`で拒否する。

| 操作     | エンドポイント              | クライアント本文              | 成功時の応答              |
| -------- | --------------------------- | ----------------------------- | ------------------------- |
| 一覧取得 | `GET /api/decks`            | なし                          | `{ decks: SavedDeck[] }`  |
| 作成     | `POST /api/decks`           | `{ name, cardDefinitionIds }` | `201 { deck: SavedDeck }` |
| 取得     | `GET /api/decks/:deckId`    | なし                          | `{ deck: SavedDeck }`     |
| 置換     | `PUT /api/decks/:deckId`    | `{ name, cardDefinitionIds }` | `{ deck: SavedDeck }`     |
| 削除     | `DELETE /api/decks/:deckId` | なし                          | `204`                     |

対戦作成・参加時も、保存済みデッキを現在のルールで再検証する。削除済みまたは無効化されたデッキは`404 DECK_NOT_FOUND`として扱い、`MatchLobby`へ渡さない。

## 順序と再同期

1. クライアントは`stateVersion`とイベント`sequence`を保持する。
2. `phaseSequence`が古い操作は、遅延コマンドとして拒否する。
3. `clientStateVersion`が現在より大きい操作は拒否する。現在より小さい場合は、最新状態に対してカード位置、対象、みなもと、フェーズを再検証する。
4. クライアントがイベント連番の欠落を検出した場合は、差分適用を止めてスナップショットを取得する。
5. UI演出は公開イベントを使うが、確定した`PlayerGameView`の更新を待たせない。

## 未決定事項

次は本書の対象外とし、ゲームエンジンの状態遷移が完成した後に決定する。

- HTTPとWebSocketの使い分け
- メールアドレス確認、パスワード再設定、追加認証方式
- 公開対戦、ランダムマッチ、観戦
- Durable Objectの永続化形式、アラーム、イベント保持期間
- エラー表示文言

通信方式を追加しても、`GameCommand`、`PlayerGameView`、公開イベントの意味は変えない。通信形式の変更が必要な場合は、`@disastar/contracts`のDTOをバージョン追加し、ゲームエンジンの型正本を複製しない。
