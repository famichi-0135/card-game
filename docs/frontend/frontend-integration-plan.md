# フロントエンド連携の実装計画

## 1. 目的と結論

本書は、フロントエンド実装を開始する前に、[対戦画面 UI 要件](./game-board-ui-requirements.md)、[フロントエンド要件定義](./frontend-requirements.md)、[通信境界](../backend/client-server-protocol.md)、[ゲームエンジン仕様書](../game/gameEngine-definition.md)と現在の実装を照合した結果を記録する。

対戦画面の体験要件である「固定 5 枠」「ドラッグアンドドロップ」「公開状態だけによる事前判定」「HTTP から開始」は維持する。実装に必要な公開契約である**契約ゲート**は完了しており、フロントエンドはこの契約だけを使って盤面と操作候補を描画する。

## 2. 現状

実装済みの範囲は次のとおりである。

- `GET /api/games/:gameId`、`POST /api/games/:gameId/commands`、対戦待機、保存済みデッキの HTTP API がある。
- `GameSession` Durable Object は状態、イベント、コマンド結果、フェーズアラームを永続化する。
- Better Auth のセッションを使ってゲーム・対戦・デッキ API を認証する。
- Frontend Worker は同一オリジンの `/api/*` を `BACKEND` Service Binding へ転送する。

一方、Frontend はスターター画面のままであり、ルーター、サーバー状態キャッシュ、認証クライアント、対戦 UI、`@dnd-kit/react` は未導入である。固定スロット、盤面数値、公開カードカタログ、D&D の可否を返す合法手判定 API は契約ゲートで実装済みである。

## 3. 変更判断

| ID   | 確認結果                                                                                                                      | 決定                                                                                                                       | 担当                              | フロントエンド開始への影響 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------- |
| G-01 | `AttackGroup` と `PLACE_ATTACK_CARD` に `slotIndex` がなく、除去後の固定位置を表せない。                                      | 実装済み: `slotIndex` を必須化し、範囲・重複をエンジンで検証する。                                                         | Game engine / Backend             | 完了                       |
| G-02 | `PlayerGameView` にグループの現在パワー・必要みなもと、属性別の予約量・使用可能量がない。                                     | 実装済み: UI 側で内部ルールを再計算せず、ゲームエンジンの公開ビューが計算済み値を返す。                                    | Game engine / Backend             | 完了                       |
| G-03 | `cardCatalogVersion` は返るが、公開カードカタログを取得する DTO・HTTP API がない。                                            | 実装済み: バージョン指定の公開カタログ API を追加し、内部効果設定を投影前に除外する。                                      | Game engine / Contracts / Backend | 完了                       |
| G-04 | `getAvailableGameActions` が未実装である。                                                                                    | 実装済み: ブラウザ非依存の純粋 API をゲームエンジンに追加した。クライアントはこれだけで D&D の可否を判断する。             | Game engine                       | 完了                       |
| F-01 | スナップショットには特定 `commandId` の結果がないため、通信失敗時に GET だけでは受理・拒否を判別できない。                    | フロントエンド要件を変更し、同じ `commandId` で同じ POST を再送して結果を取得する。GET は正規状態への再同期専用とする。    | Frontend                          | 必須                       |
| F-02 | 相手操作を即時に反映しつつ、通知接続が切断しても盤面を復旧できる必要がある。                                                  | WebSocketは更新通知だけを受信し、可視中は2秒間隔の差分ポーリングを継続する。通知受信時はHTTPスナップショットを再取得する。 | Frontend / Backend                | 必須                       |
| B-01 | `GameSession` は現在の固定 `gameEngineContext` を直接使用しており、仕様上要求するゲーム開始時のバージョン固定を再解決しない。 | 実装済み: ゲーム開始時の不変コンテキストを保存し、状態とのバージョン一致を検証して使用する。                               | Backend                           | 完了                       |
| B-02 | Durable Object の文書には「標準 Worker の認証アダプター未接続」とあるが、実装は Better Auth を標準で使用している。            | バックエンド文書を実装に合わせて修正する。                                                                                 | Backend docs                      | 文書修正のみ               |
| F-03 | 要件は React Query を前提にしているが、依存関係にない。ルーティングも未導入である。                                           | `@tanstack/react-query`、`react-router`、`@dnd-kit/react` をフロントエンド基盤 PR で導入する。                             | Frontend                          | 読み取り専用盤面の前提     |

`G-04` は完了した。固定 5 枠を可変配列の見た目だけで補う、またはカード効果をフロントエンド固有の規則で再計算する案は採用しない。フロントエンドは `getAvailableGameActions` の結果だけから D&D の候補を表示する。

## 4. 契約ゲート

### 4.1 固定スロットと公開盤面

ゲームルールの `maxAttackGroups` は初回リリースで 5 とする。攻撃グループには所有者内で一意な `slotIndex: 0 | 1 | 2 | 3 | 4` を持たせる。新規配置は空のスロットを明示して送信し、グループ除去後も他グループの `slotIndex` を変更しない。

`PlayerGameView` は表示用に次を含める。いずれも公開情報から導出でき、非公開情報を増やさない。

```ts
type VisibleAttackGroup = {
  groupId: AttackGroupId;
  slotIndex: 0 | 1 | 2 | 3 | 4;
  ownerId: PlayerId;
  attribute: Attribute;
  createdRound: number;
  cards: VisibleCardInstance[];
  requiredMana: number;
  currentPower: number;
};

type PublicPlayerState = {
  // 既存項目
  mana: Record<Attribute, CalculatedManaState>;
};
```

`createPlayerView` は `GameEngineContext` を受け、サーバーで計算した値を返す。既存 `GameSession` の保存済み攻撃グループに `slotIndex` がない場合、読み込み時に作成順で空き枠を割り当てて同じストレージキーへ永続化する。再接続猶予中の終了済みゲームも、この移行対象に含める。

### 4.2 公開カードカタログ

公開カードカタログは内部 `CardCatalog` をそのまま返さない。`cardCatalogVersion` をキーとする不変 DTO を `@disastar/game-engine/contracts` に定義し、通信用のレスポンスを `@disastar/contracts` に定義する。

```text
GET /api/card-catalogs/:cardCatalogVersion
200 { catalog: PublicCardCatalog }
404 { error: { code: "CARD_CATALOG_NOT_FOUND" } }
```

- カタログはログイン前を含めて取得可能とする。ただし、対戦画面は認証済みのゲームスナップショットを取得した後、その `cardCatalogVersion` だけを要求する。
- `PublicCardCatalog` は `version` と定義 ID ごとの `PublicCardDefinition` を含む。
- エントリには `name`、`faction`、`attribute`、`cardType`、`cost`、`basePower`、`duration`、`rulesText`、`imageAssetId`、`PublicCardInteraction` を含める。
- `PublicCardInteraction` には攻撃カードの連鎖先定義 ID、およびサポート効果ごとの `effectId`、対象数、対象領域、対象所有者、対象選択順だけを含める。`handlerId`、`config`、未公開条件、乱数 seed は含めない。
- `rulesText` と `imageAssetId` は、各カード定義に属するバージョン管理された `presentation` メタデータを正本にする。初回実装の `imageAssetId` は `null` を許容し、Frontend は属性・種別を示すプレースホルダーを表示する。
- レスポンスはゲーム開始時に固定したカタログバージョンから生成する。現在版のカタログへ黙って差し替えない。

### 4.3 クライアント用の合法手判定

ゲームエンジンは、公開情報だけを入力にする次の API を提供する。

```ts
getAvailableGameActions({
  view: PlayerGameView,
  catalog: PublicCardCatalog,
  now: number,
}): AvailableGameActions;
```

返り値には、少なくともカードごとの新規配置可能スロット、連鎖可能グループ、破棄可否、サポートの対象候補・選択段階、フェーズ終了可否、安定した利用不能理由コードを含める。

この API はユーザーの操作候補を示すだけであり、サーバーの `executeCommand` を置き換えない。実装では公開・非公開で共通に使える判定部品を共有し、同じ公開可能条件について `getAvailableGameActions` と `executeCommand` が食い違わないテストを追加する。相手の同時操作、サーバー受信時刻、コマンド再送はサーバーだけが最終判定する。

### 4.4 HTTP 同期と再送

初回ロード、フォーカス復帰、通信エラー、イベント連番の欠落時は次を実施する。

1. `GET /api/games/:gameId?afterSequence=<lastEventSequence>` を呼ぶ。
2. 応答の `view` を正規状態として置き換える。
3. 連続する公開イベントだけを演出キューへ追加する。連番が欠落していた場合、欠落した演出は再生せず、取得した正規状態を表示する。
4. `cardCatalogVersion` が変化した場合だけ、対応する公開カードカタログを取得してから操作を再有効化する。

コマンド POST がタイムアウトまたはネットワーク失敗した場合は、送信内容と `commandId` を保持し、同じ `POST /api/games/:gameId/commands` を同じ本文で再送する。`GameSession` が保存した最初の `SubmitGameCommandResponse` を取得できたら保留状態を解除し、その `view` を採用する。POST の再送上限に達した場合、またはブラウザがオフラインの場合は GET で表示状態だけを再同期し、ユーザーが再試行または離脱できる状態にする。GET の結果だけから当該コマンドの受理・拒否を推測してはならない。

ページが可視かつゲームが終了していない間は、最後に確認した `sequence` を使って 2 秒ごとに差分ポーリングする。タブが非表示の間は停止し、`visibilitychange` と `focus` でただちに同期する。加えて`GET /api/games/:gameId/events`へWebSocket接続し、`GAME_UPDATED`を受信したら完全スナップショットを取り直す。WebSocketは状態を運ばないため、切断中もポーリングで同じ再同期規則を維持する。

## 5. 実装順序

### フェーズ 0: 契約ゲート

1. 実装済み: Game engine の `slotIndex`、公開盤面数値、`PublicCardCatalog`、対応する単体・境界テストを実装する。
2. 実装済み: Contracts / Backend の公開カタログ API、バージョン固定コンテキスト、保存形式移行、HTTP API テストを実装する。
3. 実装済み: `getAvailableGameActions` をゲームエンジンへ追加し、公開状態からカードごとの配置・連鎖・破棄・サポート候補とフェーズ終了可否を導出する。
4. 受け入れ: 1 つのスナップショットと同じカタログだけで、5 枠・手札・捨て札・サポート・みなもと・グループ数値を表示できる。相手の手札・山札・内部効果設定は取得できない。

### フェーズ 1: フロントエンド基盤と静的盤面

1. 実装済み: `react-router`、`@tanstack/react-query`、`@dnd-kit/react`、`@disastar/game-engine` を追加する。
2. 実装済み: `/games/:gameId` のルート、同一オリジンの API クライアント、認証ガードの土台、エラー境界、PC 非対応サイズ表示を作る。`/games/demo` は API 接続前の盤面確認専用フィクスチャとする。
3. 実装済み: 契約フィクスチャで読み取り専用の 5 枠盤面、カード詳細、プレースホルダー、アクセシブルなフォーカス操作を実装する。
4. 受け入れ: 1180 x 720、1280 x 720、1440 x 900 で縦・横スクロールと要素重なりがない。静的画面の実装後にヘッドレスブラウザで各解像度を確認する。

### フェーズ 2: HTTP 接続と攻撃操作

1. スナップショット、カタログ取得、2 秒ポーリング、POST 再送を接続する。
2. 合法手 API の結果だけを使い、攻撃カードの配置、連鎖、破棄の D&D とキーボード代替操作を実装する。
3. 確定状態の楽観更新は行わず、送信中のカードとフェーズ終了をロックする。
4. 受け入れ: 不正なドロップから POST せず、拒否・再送・タイムアウト後に正規状態へ復帰する。

### フェーズ 3: サポート操作と終了状態

1. ローカル操作トレイ、`PublicCardInteraction` に従う複数対象選択、キャンセル、`PLAY_SUPPORT_CARD` を実装する。
2. `FINISH_PLACEMENT` と `FINISH_SUPPORT` だけに確認ダイアログを付ける。
3. 公開イベント演出、`prefers-reduced-motion`、勝敗表示を実装する。
4. 受け入れ: マウスとキーボードの両方で全プレイヤーコマンドを実行でき、相手の非公開情報が DOM・ログ・キャッシュにない。

### フェーズ 4: 周辺導線

1. 実装済み: 認証画面、メール確認・パスワード再設定、対戦・待機部屋 URL からの同一オリジン内戻り先制御を実装する。
2. 実装済み: トップ、保存済みデッキ選択、スターターデッキ生成、招待部屋の作成・参加・取消、2秒ポーリング、対戦開始時の遷移を実装する。
3. 受け入れ: 認証済みの2人で異なる陣営のデッキを選び、招待 URL を経由して対戦開始まで到達できることを Worker 統合環境で確認する。

防災情報画面と保存済みデッキの編集は対戦導線と別 PR に分ける。

## 6. PR の分け方

| PR  | 主な変更                                 | マージ条件                                       |
| --- | ---------------------------------------- | ------------------------------------------------ |
| 1   | Game engine の公開契約と固定スロット     | エンジン単体テスト、公開情報テスト、契約レビュー |
| 2   | 公開カタログ API とバージョン解決        | Backend / Worker テスト、認可・秘匿レビュー      |
| 3   | Frontend のルーティング・Query・静的盤面 | 対応解像度の画面テスト、アクセシビリティ確認     |
| 4   | HTTP 接続・攻撃 D&D                      | API モックと実 Worker の統合テスト               |
| 5   | サポート操作・再送・イベント             | 競合、拒否、通信断、情報秘匿の統合テスト         |
| 6   | 認証・待機部屋導線                       | Better Auth を使う E2E テスト                    |

PR 1 と PR 2 はフロントエンド実装の契約ゲートであり、作成者以外のチームメンバーが型・秘匿境界をレビューしてからマージする。PR 3 はフィクスチャで先行できるが、実 API を接続する変更は PR 1 と PR 2 のマージ後に行う。

## 7. 初回リリース外

- 対戦切断の猶予・自動敗北ルール
- モバイル向け対戦レイアウト
- 観戦、リプレイ、対戦チャット
- デッキ編集画面
- 正式カード画像と大きな常時演出

WebSocket を導入する場合も、ゲームコマンド、公開カタログ、`PlayerGameView`、イベント連番、再送・再同期の意味を変えない。
