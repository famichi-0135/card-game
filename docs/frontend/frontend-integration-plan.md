# フロントエンド連携の実装計画

## 1. 目的と結論

本書は、フロントエンド実装を開始する前に、[対戦画面 UI 要件](./game-board-ui-requirements.md)、[フロントエンド要件定義](./frontend-requirements.md)、[通信境界](../backend/client-server-protocol.md)、[ゲームエンジン仕様書](../game/gameEngine-definition.md)と現在の実装を照合した結果を記録する。

対戦画面の体験要件である「固定 5 枠」「ドラッグアンドドロップ」「公開状態だけによる事前判定」「HTTP から開始」は維持する。一方で、それを実装するための公開契約はまだ揃っていない。カード画面を API に直結して実装し始めず、まず本書の**契約ゲート**を完了する。

## 2. 現状

実装済みの範囲は次のとおりである。

- `GET /api/games/:gameId`、`POST /api/games/:gameId/commands`、対戦待機、保存済みデッキの HTTP API がある。
- `GameSession` Durable Object は状態、イベント、コマンド結果、フェーズアラームを永続化する。
- Better Auth のセッションを使ってゲーム・対戦・デッキ API を認証する。
- Frontend Worker は同一オリジンの `/api/*` を `BACKEND` Service Binding へ転送する。

一方、Frontend はスターター画面のままであり、ルーター、サーバー状態キャッシュ、認証クライアント、対戦 UI、`@dnd-kit/react` は未導入である。また、現行の `PlayerGameView` とゲームコマンドには、固定スロット・盤面数値・公開カードカタログ・合法手判定 API がない。

## 3. 変更判断

| ID | 確認結果 | 決定 | 担当 | フロントエンド開始への影響 |
| -- | -------- | ---- | ---- | -------------------------- |
| G-01 | `AttackGroup` と `PLACE_ATTACK_CARD` に `slotIndex` がなく、除去後の固定位置を表せない。 | UI 要件は維持し、ゲームエンジンとバックエンドを変更する。 | Game engine / Backend | 操作実装の必須前提 |
| G-02 | `PlayerGameView` にグループの現在パワー・必要みなもと、属性別の予約量・使用可能量がない。 | UI 側で内部ルールを再計算しない。ゲームエンジンの公開ビューを拡張する。 | Game engine / Backend | 読み取り専用盤面の必須前提 |
| G-03 | `cardCatalogVersion` は返るが、公開カードカタログを取得する DTO・HTTP API がない。 | バックエンドにバージョン指定の公開カタログ API を追加する。 | Game engine / Contracts / Backend | カード表示・操作判定の必須前提 |
| G-04 | `getAvailableGameActions` が未実装である。 | ブラウザ非依存の純粋 API をゲームエンジンに追加する。クライアントはこれだけで D&D の可否を判断する。 | Game engine | 操作実装の必須前提 |
| F-01 | スナップショットには特定 `commandId` の結果がないため、通信失敗時に GET だけでは受理・拒否を判別できない。 | フロントエンド要件を変更し、同じ `commandId` で同じ POST を再送して結果を取得する。GET は正規状態への再同期専用とする。 | Frontend | 必須 |
| F-02 | HTTP 初期実装の相手操作反映頻度が未定義である。 | WebSocket を初回リリースから外し、可視中は 2 秒間隔の差分ポーリングを行う。 | Frontend | 必須 |
| B-01 | `GameSession` は現在の固定 `gameEngineContext` を直接使用しており、仕様上要求するゲーム開始時のバージョン固定を再解決しない。 | 進行中ゲームの `rulesetVersion`、`cardCatalogVersion`、`engineSemanticsVersion` から不変コンテキストを解決する実装へ変更する。 | Backend | 公開カタログ導入と同じ契約ゲート |
| B-02 | Durable Object の文書には「標準 Worker の認証アダプター未接続」とあるが、実装は Better Auth を標準で使用している。 | バックエンド文書を実装に合わせて修正する。 | Backend docs | 文書修正のみ |
| F-03 | 要件は React Query を前提にしているが、依存関係にない。ルーティングも未導入である。 | `@tanstack/react-query`、`react-router`、`@dnd-kit/react` をフロントエンド基盤 PR で導入する。 | Frontend | 読み取り専用盤面の前提 |

`G-01` から `G-04` と `B-01` は、フロントエンドの見た目だけを先行して実装する場合を除き、実 API 接続前に完了させる。固定 5 枠を可変配列の見た目だけで補う、またはカード効果をフロントエンド固有の規則で再計算する案は採用しない。

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

`createPlayerView` は `GameEngineContext` を受け、サーバーで計算した値を返す。既存の開発用 `GameSession` は保存形式が非互換になるため、実装 PR ではストレージキーを更新して旧ローカルセッションを破棄する。正式データを扱う段階では、明示的なマイグレーションを別途設計する。

### 4.2 公開カードカタログ

公開カードカタログは内部 `CardCatalog` をそのまま返さない。`cardCatalogVersion` をキーとする不変 DTO を `@disastar/game-engine/contracts` に定義し、通信用のレスポンスを `@disastar/contracts` に定義する。

```text
GET /api/card-catalogs/:cardCatalogVersion
200 { catalog: PublicCardCatalog }
404 { error: { code: "CARD_CATALOG_NOT_FOUND" } }
```

- カタログはログイン前を含めて取得可能とする。ただし、対戦画面は認証済みのゲームスナップショットを取得した後、その `cardCatalogVersion` だけを要求する。
- `PublicCardCatalog` は `version` と定義 ID ごとの `CardCatalogEntryView` を含む。
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

ページが可視かつゲームが終了していない間は、最後に確認した `sequence` を使って 2 秒ごとに差分ポーリングする。タブが非表示の間は停止し、`visibilitychange` と `focus` でただちに同期する。WebSocket は HTTP 実装と同じ DTO・再同期規則を使う後続 PR とし、初回リリースの完了条件に含めない。

## 5. 実装順序

### フェーズ 0: 契約ゲート

1. Game engine: `slotIndex`、公開盤面数値、`PublicCardCatalog`、`getAvailableGameActions`、対応する単体・境界テストを実装する。
2. Contracts / Backend: 公開カタログ API、バージョンコンテキスト解決、保存形式の更新、HTTP API テストを実装する。
3. 受け入れ: 1 つのスナップショットと同じカタログだけで、5 枠・手札・捨て札・サポート・みなもと・グループ数値を表示できる。相手の手札・山札・内部効果設定は取得できない。

### フェーズ 1: フロントエンド基盤と静的盤面

1. `react-router`、`@tanstack/react-query`、`@dnd-kit/react` を追加する。
2. `/games/:gameId` のルート、同一オリジンの API クライアント、認証ガード、エラー境界、PC 非対応サイズ表示を作る。
3. 契約フィクスチャで読み取り専用の 5 枠盤面、カード詳細、プレースホルダー、アクセシブルなフォーカス操作を実装する。
4. 受け入れ: 1180 x 720、1280 x 720、1440 x 900 で縦・横スクロールと要素重なりがない。

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

認証画面と戻り先制御を先に完成させ、その上でトップ、デッキ選択、待機部屋、対戦開始遷移を実装する。防災情報画面は対戦機能と別 PR に分ける。

## 6. PR の分け方

| PR | 主な変更 | マージ条件 |
| -- | -------- | ---------- |
| 1 | Game engine の公開契約と固定スロット | エンジン単体テスト、公開情報テスト、契約レビュー |
| 2 | 公開カタログ API とバージョン解決 | Backend / Worker テスト、認可・秘匿レビュー |
| 3 | Frontend のルーティング・Query・静的盤面 | 対応解像度の画面テスト、アクセシビリティ確認 |
| 4 | HTTP 接続・攻撃 D&D | API モックと実 Worker の統合テスト |
| 5 | サポート操作・再送・イベント | 競合、拒否、通信断、情報秘匿の統合テスト |
| 6 | 認証・待機部屋導線 | Better Auth を使う E2E テスト |

PR 1 と PR 2 はフロントエンド実装の契約ゲートであり、作成者以外のチームメンバーが型・秘匿境界をレビューしてからマージする。PR 3 はフィクスチャで先行できるが、実 API を接続する変更は PR 1 と PR 2 のマージ後に行う。

## 7. 初回リリース外

- WebSocket、接続休止、プレゼンス
- モバイル向け対戦レイアウト
- 観戦、リプレイ、対戦チャット
- デッキ編集画面
- 正式カード画像と大きな常時演出

WebSocket を導入する場合も、ゲームコマンド、公開カタログ、`PlayerGameView`、イベント連番、再送・再同期の意味を変えない。
