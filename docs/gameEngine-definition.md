# ゲームエンジン仕様書

## 1. 文書概要

本書は、「基本ゲームルール定義書」に基づき、ゲームエンジンが管理する状態、受け付けるコマンド、生成するイベント、状態遷移、検証条件および数値計算方法を定義する。

本書の目的は、同じ入力と同じ初期状態から、常に同じゲーム結果を生成できる決定的なゲームエンジンを実装することである。

---

## 2. ゲームエンジンの責務

ゲームエンジンは、次の処理を担当する。

- デッキ構築条件の検証
- デッキのシャッフル
- 初期手札の決定
- 第1ラウンドの先攻決定
- ゲーム状態の保持
- プレイヤー操作の正当性検証
- 攻撃カードの配置
- 攻撃カードの連鎖
- 手札からのカード破棄
- サポートカードの使用
- カード効果の解決
- みなもとの計算
- 攻撃力および総パワーの計算
- スタミナの反映
- 勝敗判定
- ラウンド進行
- タイムアウト処理
- 山札切れ判定
- 最大ラウンド判定
- ゲームイベントの生成
- プレイヤーごとの公開状態の生成

ゲームエンジンは、次の処理を担当しない。

- WebSocket通信
- HTTP通信
- データベースへの直接保存
- UIアニメーション
- フロントエンドのドラッグ操作
- 認証
- ルーム作成および入退室
- 再接続処理そのもの
- Cloudflare Durable Objects固有の処理

これらは、ゲームエンジンを利用するバックエンド層で処理する。

---

## 3. アーキテクチャ方針

ゲームエンジンは、特定のフレームワークやインフラストラクチャに依存しない純粋なパッケージとして実装する。

ワークスペースパッケージ名は`@disastar/game-engine`を推奨する。バックエンドは実行APIを使用し、フロントエンドは`import type`でコマンド、公開状態、公開イベントの契約だけを参照する。

推奨配置例：

```text
packages/
└─ game-engine/
   ├─ src/
   │  ├─ contracts/
   │  │  ├─ identifiers.ts
   │  │  ├─ card-definition.ts
   │  │  ├─ effect-definition.ts
   │  │  ├─ effect-target.ts
   │  │  ├─ game-state.ts
   │  │  ├─ commands.ts
   │  │  └─ events.ts
   │  ├─ catalog/
   │  ├─ domain/
   │  ├─ commands/
   │  ├─ effects/
   │  ├─ calculation/
   │  ├─ validation/
   │  ├─ events/
   │  ├─ projection/
   │  └─ index.ts
   └─ tests/
```

`contracts/`内の型だけをパッケージ外へ公開し、他のディレクトリから同名の公開型を再定義しない。フロントエンドとバックエンドは、必要なコマンド型、公開状態型、公開イベント型をこのパッケージから型として参照する。

バックエンド側は、ゲームエンジンへ現在状態とコマンドを渡し、返された新しい状態とイベントを永続化・配信する。

```text
クライアント
↓
Backend / Durable Object
↓
ゲームエンジンへコマンドを渡す
↓
新しい状態とイベントを受け取る
↓
状態を永続化
↓
各クライアントへ公開状態とイベントを配信
```

---

## 4. 決定性

ゲームエンジン内部では、次の機能を直接呼び出してはならない。

- `Math.random()`
- `Date.now()`
- ランダムUUID生成
- 外部API
- データベース
- ネットワーク通信

乱数、現在時刻、ID生成は外部から注入する。

```ts
export type GameEngineDependencies = {
  random: RandomGenerator;
  clock: GameClock;
  idGenerator: IdGenerator;
};
```

カード定義、ルール、効果ハンドラーは、対戦中に変更されないコンテキストとして別に渡す。

```ts
export type GameEngineContext = {
  rules: Readonly<GameRules>;
  cardCatalog: CardCatalog;
  effectRegistry: Readonly<EffectRegistry>;
  engineSemanticsVersion: EngineSemanticsVersion;
};
```

`GameEngineDependencies`は同じ入力を再現するための実行時依存、`GameEngineContext`はゲームの意味を固定する不変な依存として区別する。

```ts
export type RandomSequence = {
  next(): number;
};

export type RandomGenerator = {
  create(seed: string): RandomSequence;
};
```

同じseedから作った乱数列は、常に同じ値列を返す。`next()`は`0以上1未満`の有限数を返す。範囲外、`NaN`、無限値は依存性エラーとして扱う。初期手札の引き直しは無限ループを避けるため`MAX_INITIAL_HAND_ATTEMPTS = 20`の試行上限を持ち、上限到達時は`INITIAL_HAND_SELECTION_FAILED`として初期化を失敗させ、状態を保存しない。

```ts
export type GameClock = {
  now(): number;
};
```

`GameClock`は初期化開始時刻など、コマンド外でバックエンドが確定させる時刻にだけ使用する。コマンド実行中は`ReceivedCommandEnvelope.receivedAt`を状態遷移時刻とイベント時刻の基準にし、処理途中で実時計を読み直さない。

```ts
export type EntityIdKind = "cardInstance" | "attackGroup" | "activeEffect";

export type IdGenerationInput = {
  kind: EntityIdKind;
  gameId: GameId;
  seed: string;
};

export type IdGenerator = {
  generate(input: IdGenerationInput): string;
};
```

ID生成器は同じ入力に常に同じIDを返す純粋関数とする。カード実体にはプレイヤーIDとデッキ内位置、攻撃グループにはコマンドID、アクティブ効果には効果ID・対象位置・`nextEffectSequence`から作った安定seedを使用する。同一ゲーム内で同じ種類のIDを重複して返してはならない。

エンジンはカード、グループ、効果の登録前に衝突を検証し、衝突時はコマンドまたは初期化全体を失敗させる。これにより、保存前に同じ処理を再実行してもIDとイベント内容が変わらない。

テストでは固定乱数、固定時刻、固定ID生成器を渡すことで、同じ結果を再現できるようにする。

---

## 5. 基本定数

```ts
export type RulesetVersion = string;

export type GameRules = {
  version: RulesetVersion;
  playerCount: number;
  deckSize: number;
  initialStamina: number;
  initialDrawCount: number;
  handLimit: number;
  maxAttackGroups: number;
  placementTimeLimitMs: number;
  supportTimeLimitMs: number;
  maxRounds: number;
  minManaCards: number;
  maxManaCards: number;
  minAttackCards: number;
  maxSupportCards: number;
  maxSameNamedAttackCards: number;
  maxSameNamedSupportCards: number;
};

export const GAME_RULES: Readonly<GameRules> = {
  version: "ruleset-v1",
  playerCount: 2,
  deckSize: 30,
  initialStamina: 25,
  initialDrawCount: 5,
  handLimit: 5,
  maxAttackGroups: 5,
  placementTimeLimitMs: 90_000,
  supportTimeLimitMs: 60_000,
  maxRounds: 30,
  minManaCards: 8,
  maxManaCards: 12,
  minAttackCards: 11,
  maxSupportCards: 7,
  maxSameNamedAttackCards: 2,
  maxSameNamedSupportCards: 2,
};
```

制限時間などの調整可能な数値は、可能な限り設定値として外部から渡せる構造にする。

`GameRules`はコンテキスト構築時に検証する。初期エンジンでは`playerCount === 2`、枚数・スタミナ・グループ数・ラウンド数・時間が0以上の安全な整数、最小値が対応する最大値以下、デッキ種別条件を同時に満たせることを必須とする。検証済みルールは対戦中に変更しない。

---

## 6. 識別子

対戦中のカード指定には、カード定義IDではなくカードインスタンスIDを使用する。

```ts
export type GameId = string;
export type PlayerId = string;
export type CardDefinitionId = string;
export type CardInstanceId = string;
export type AttackGroupId = string;
export type EffectInstanceId = string;
export type EffectId = string;
export type CommandId = string;
export type CardCatalogVersion = string;
export type EngineSemanticsVersion = string;
```

同名カードが複数存在する場合でも、カードインスタンスIDによって一意に識別する。

---

## 7. 属性

すべてのカードは1種類の属性を持つ。

```ts
export type Attribute = "attributeA" | "attributeB" | "attributeC";
```

実際の属性名は、カードゲームの正式名称に合わせて変更する。

次のカードは存在しない。

- 無属性カード
- 複数属性カード
- 任意属性で使用できるカード
- 複数属性のみなもとを同時に要求するカード

---

## 8. カード定義

### 8.1 共通定義

```ts
export type BaseCardDefinition = {
  id: CardDefinitionId;
  name: string;
  attribute: Attribute;
  cardType: "mana" | "attack" | "support";
};
```

### 8.2 みなもとカード

```ts
export type ManaCardDefinition = BaseCardDefinition & {
  cardType: "mana";
  manaAmount: 1;
};
```

すべてのみなもとカードは、対応属性のみなもと総量を1増加させる。

### 8.3 攻撃カード

```ts
export type AttackCardDefinition = BaseCardDefinition & {
  cardType: "attack";
  cost: number;
  basePower: number;
  chainableCardIds: CardDefinitionId[];
  effects: CardEffectDefinition[];
};
```

`chainableCardIds`は、このカードの上に配置できるカード定義IDを表す。

攻撃カード効果を追加しても型と配置処理を変更せずに済むよう、`effects`は初期実装から保持する。初期カードカタログでは攻撃カードの`effects`を空配列とする。

### 8.4 サポートカード

```ts
export type SupportDuration = "instant" | "untilRoundEnd" | "permanent";
```

```ts
export type SupportCardDefinition = BaseCardDefinition & {
  cardType: "support";
  cost: number;
  duration: SupportDuration;
  effects: CardEffectDefinition[];
};
```

発動形式はカード単位ではなく、`effects`内の各`CardEffectDefinition`が保持する。これにより、1枚のカードが`onPlay`効果と`continuous`効果を同時に持てる。

### 8.5 カード定義の統合型

```ts
export type CardDefinition =
  | ManaCardDefinition
  | AttackCardDefinition
  | SupportCardDefinition;
```

### 8.6 カードカタログ

カード定義は、バージョンごとに不変なカタログとして管理する。

```ts
export type CardCatalog = {
  readonly version: CardCatalogVersion;
  readonly definitions: Readonly<
    Record<CardDefinitionId, DeepReadonly<CardDefinition>>
  >;
};
```

同じ`CardCatalogVersion`が異なる定義内容を指してはならない。進行中ゲームの再開に必要なバージョンを取得できるようにするか、対戦開始時に使用カード定義のスナップショットを永続化する。

`CardDefinition`、`CardEffectDefinition`、`EffectTarget`などの共有型は、実装時に`packages/game-engine/src/contracts/`を唯一の正本とする。本書と「カード効果仕様書」は、その同じ契約を説明する文書であり、別実装の型を作らない。

---

## 9. カードインスタンス

```ts
export type CardInstance = {
  instanceId: CardInstanceId;
  definitionId: CardDefinitionId;
  ownerId: PlayerId;
};
```

カード定義は変更されない静的情報として`CardCatalog`に保持し、対戦中に生成されたすべてのカード実体は`GameState.cardInstances`に保持する。山札、手札、捨て札、攻撃グループ、サポートゾーンはカード実体そのものを複製せず、カードインスタンスIDだけを参照する。

参照経路は常に次のとおりとする。

```text
CardInstanceId
→ GameState.cardInstances[CardInstanceId]
→ CardDefinitionId
→ GameEngineContext.cardCatalog.definitions[CardDefinitionId]
```

---

## 10. ゲーム状態

```ts
export type GameState = {
  gameId: GameId;
  initialRandomSeed: string;
  rulesetVersion: RulesetVersion;
  cardCatalogVersion: CardCatalogVersion;
  engineSemanticsVersion: EngineSemanticsVersion;

  stateVersion: number;
  status: GameStatus;
  round: number;
  phase: GamePhase;
  phaseSequence: number;
  phaseStartedAt: number;
  phaseDeadlineAt: number | null;

  playerOrder: [PlayerId, PlayerId];
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;

  players: Record<PlayerId, PlayerState>;
  cardInstances: Record<CardInstanceId, CardInstance>;

  activeEffects: ActiveEffect[];
  supportFinishedBy: PlayerId[];

  lastRoundResult: RoundResult | null;
  winner: GameWinner | null;

  processedCommandIds: CommandId[];
  nextEffectSequence: number;
  nextEventSequence: number;
};
```

状態を読み込むときは、3つのバージョンが`GameEngineContext`と一致することを検証する。バージョン文字列だけを保存して実体を取得できない状態を作ってはならない。

---

## 11. ゲームステータス

```ts
export type GameStatus = "initializing" | "active" | "finished";
```

- `initializing`: 初期状態構築中
- `active`: 対戦進行中
- `finished`: 勝敗確定済み

`finished`になったゲームは、ゲーム進行コマンドを受け付けない。

---

## 12. ゲームフェーズ

```ts
export type GamePhase =
  | "initializing"
  | "firstPlayerPlacement"
  | "secondPlayerPlacement"
  | "support"
  | "resolution"
  | "cleanup"
  | "refill"
  | "finished";
```

### 12.1 操作可能フェーズ

プレイヤーが操作できるのは、次のフェーズだけとする。

- `firstPlayerPlacement`
- `secondPlayerPlacement`
- `support`

### 12.2 自動処理フェーズ

次のフェーズはバックエンド上で自動進行する。

- `resolution`
- `cleanup`
- `refill`

基本ルール上の細かな処理区分と、永続化する`GamePhase`の対応は次のとおりとする。

| 基本ルール上の処理                       | `GamePhase`                        |
| ---------------------------------------- | ---------------------------------- |
| スコア計算、通常勝敗、最大ラウンド判定   | `resolution`                       |
| 場の整理                                 | `cleanup`                          |
| 山札切れ事前判定、手札補充、みなもと処理 | `refill`                           |
| 次ラウンド開始                           | `firstPlayerPlacement`への遷移処理 |

自動処理は、原則として1回の排他的トランザクション内で最後まで実行する。

フロントエンドは、自動フェーズの途中状態ではなく、生成されたゲームイベントを利用してアニメーションを表示する。

フェーズが変わるたびに`phaseSequence`を1増加させる。同じ名前のフェーズが別ラウンドで再び現れても、同じ`phaseSequence`を再利用してはならない。操作可能フェーズへ移るときは、同時に`phaseStartedAt`と`phaseDeadlineAt`を更新する。

---

## 13. プレイヤー状態

```ts
export type PlayerState = {
  playerId: PlayerId;
  stamina: number;

  deck: CardInstanceId[];
  hand: CardInstanceId[];
  discardPile: CardInstanceId[];

  battlefield: BattlefieldState;
  mana: ManaState;
};
```

---

## 14. バトルゾーン

```ts
export type BattlefieldState = {
  attackGroups: AttackGroup[];
  supportZone: SupportCardOnField[];
};
```

### 14.1 攻撃グループ

```ts
export type AttackGroup = {
  groupId: AttackGroupId;
  ownerId: PlayerId;
  attribute: Attribute;
  cardIds: CardInstanceId[];
  createdRound: number;
};
```

`cardIds`は、下から上の順番で保持する。

```text
cardIds[0] = 一番下のカード
cardIds[cardIds.length - 1] = 一番上のカード
```

### 14.2 場に存在するサポートカード

```ts
export type SupportCardOnField = {
  cardInstanceId: CardInstanceId;
  ownerId: PlayerId;
  playedRound: number;
  playedSequence: number;
  duration: SupportDuration;
};
```

サポートゾーンはUI上1枠として表示するが、内部的には複数カードを保持できる。

---

## 15. みなもと状態

```ts
export type ManaState = Record<
  Attribute,
  {
    total: number;
  }
>;
```

使用中みなもとと使用可能みなもとは、状態として直接保存せず、現在のバトルゾーンから計算することを推奨する。

```ts
export type CalculatedManaState = {
  total: number;
  reserved: number;
  available: number;
};
```

```text
available = total - reserved
```

これにより、カード除去時の返却漏れなどを防止する。

---

## 16. みなもとの予約量

属性ごとの使用中みなもとは、次の合計とする。

```text
攻撃グループのコスト合計
+
場に残っているサポートカードのコスト合計
```

### 16.1 攻撃グループのコスト

```ts
groupCost = max(group内に存在するカードのコスト);
```

カードが1枚も存在しないグループは保持しない。

### 16.2 サポートカードのコスト

次のサポートカードは、場に存在している間コストを予約する。

- `untilRoundEnd`
- `permanent`

`instant`カードは、使用コマンドの処理中だけ一時的にコストを必要とする。

効果解決後は捨て札へ移動するため、最終状態ではみなもとを予約しない。

### 16.3 計算関数

```ts
export function calculateMana(
  state: GameState,
  playerId: PlayerId,
  attribute: Attribute,
): CalculatedManaState;
```

結果は常に次を満たさなければならない。

```text
total >= 0
reserved >= 0
available >= 0
reserved <= total
```

---

## 17. アクティブ効果

```ts
export type EffectTarget =
  | {
      type: "attackCard";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "attackGroup";
      groupId: AttackGroupId;
    }
  | {
      type: "supportCard";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "player";
      playerId: PlayerId;
    }
  | {
      type: "mana";
      playerId: PlayerId;
      attribute: Attribute;
    };
```

```ts
export type TargetSide = "self" | "opponent" | "either";

export type TargetZone = EffectTarget["type"];

export type TargetRule = {
  required: boolean;
  minTargets: number;
  maxTargets: number;
  side: TargetSide;
  zones: TargetZone[];
  allowSourceCard: boolean;
};
```

```ts
export type PowerScope = "cardPower" | "groupPower" | "totalPower";
```

```ts
export type PowerOperation = "overwrite" | "add" | "multiply";
```

```ts
export type ActiveEffectDuration = "untilRoundEnd" | "whileSourceOnField";

export type ActiveEffect = {
  effectInstanceId: EffectInstanceId;
  effectId: EffectId;

  sourceCardInstanceId: CardInstanceId;
  ownerId: PlayerId;
  target: EffectTarget;

  scope: PowerScope;
  operation: PowerOperation;
  value: number;

  duration: ActiveEffectDuration;
  appliedSequence: number;
  appliedRound: number;
};
```

`instant`は`ActiveEffectDuration`へ含めない。`permanent`サポートおよび攻撃カードの継続効果は、実行時に`whileSourceOnField`へ変換する。

初期実装の継続効果は攻撃力変更を対象とする。将来、数値変更以外の継続ルールを追加する場合は、任意の`scope`と`value`を組み合わせず、種類ごとの判別可能な`ActiveEffect` Unionへ拡張する。

複数対象の継続効果は、対象ごとに1つの`ActiveEffect`を登録する。効果元カードまたは対象が場から離れた場合、対応する継続効果を削除する。

---

## 18. ゲーム初期化

### 18.1 初期化入力

```ts
export type InitializeGameInput = {
  gameId: GameId;
  randomSeed: string;
  players: [
    {
      playerId: PlayerId;
      deckDefinitionIds: CardDefinitionId[];
    },
    {
      playerId: PlayerId;
      deckDefinitionIds: CardDefinitionId[];
    },
  ];
};
```

カード定義は入力へ重複して含めず、`GameEngineContext.cardCatalog`から取得する。`randomSeed`はバックエンドが生成して固定し、プレイヤー入力を使用しない。

```ts
export type InitializeGameError = {
  code:
    | "INVALID_PLAYER_COUNT"
    | "DUPLICATE_PLAYER_ID"
    | "DECK_VALIDATION_FAILED"
    | "CARD_CATALOG_INVALID"
    | "DEPENDENCY_OUTPUT_INVALID"
    | "INITIAL_HAND_SELECTION_FAILED";
  message: string;
  details?: JsonObject;
};

export type InitializeGameResult =
  | {
      initialized: true;
      state: GameState;
      events: GameEventEnvelope[];
    }
  | {
      initialized: false;
      error: InitializeGameError;
    };
```

### 18.2 初期化処理

ゲーム開始時は、次の順番で処理する。

初期化開始時に`clock.now()`を1回だけ呼び、その値を初期フェーズ開始時刻と初期化イベント時刻の基準として使う。`random.create(input.randomSeed)`も1回だけ呼び、すべてのシャッフル、引き直し、先攻決定で同じローカル乱数列を順番に消費する。

1. プレイヤー数を検証する
2. コンテキストのカタログ、ルール、エンジン意味バージョンを検証する
3. 各デッキをカタログに対して検証する
4. 60枚すべてのカードインスタンスを生成して`cardInstances`へ登録する
5. 各デッキをシャッフルする
6. 各プレイヤーの初期手札を決定する
7. 初期手札に含まれるみなもとカードを処理する
8. 第1ラウンドの先攻を乱数で決定する
9. 初期スタミナをルール値に設定する
10. ラウンドを1、`phaseSequence`を1に設定する
11. `firstPlayerPlacement`へ移行する
12. ルール値に基づいてフェーズ期限を設定する
13. 3つのバージョンを`GameState`へ保存する

初期化成功時は、`status: "active"`、`stateVersion: 1`、空の`activeEffects`・`supportFinishedBy`・`processedCommandIds`、`nextEffectSequence: 1`を持つ。`nextEventSequence`は初期化イベントへ1から連番を付けた後の次番号とする。`initializing`状態は初期化処理内の一時状態であり、不完全な状態を永続化しない。

---

## 19. デッキ検証

```ts
export type DeckValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      errors: DeckValidationError[];
    };
```

```ts
export type DeckValidationError = {
  code:
    | "INVALID_DECK_SIZE"
    | "INVALID_CARD_TYPE_COUNT"
    | "SAME_NAME_LIMIT_EXCEEDED"
    | "ATTRIBUTE_REQUIREMENT_NOT_MET"
    | "CARD_DEFINITION_NOT_FOUND"
    | "CARD_DEFINITION_INVALID";
  cardDefinitionId?: CardDefinitionId;
  message: string;
};
```

検証条件は次のとおり。

### 19.1 基本枚数

- 合計30枚ちょうど
- みなもとカード8枚以上12枚以下
- 攻撃カード11枚以上
- サポートカード7枚以下

### 19.2 同名制限

- 攻撃カードは同名2枚まで
- サポートカードは同名2枚まで
- みなもとカードは枚数制限なし

### 19.3 属性条件

3属性すべてについて、次を満たす。

- 対象属性のみなもとカードが1枚以上
- 対象属性の攻撃カードまたはサポートカードが1枚以上

### 19.4 カード定義条件

- すべてのカード定義が存在する
- 攻撃カードとサポートカードはコストを持つ
- 攻撃カードは基礎攻撃力を持つ
- みなもとカードの増加量は1
- カードのコスト、基礎攻撃力、みなもと増加量は安全な整数
- コストは0以上
- 基礎攻撃力は1以上
- 効果値は「カード効果仕様書」の整数・有限数条件を満たす
- `chainableCardIds`の参照先が存在し、攻撃カードである
- カードID、カード内の効果IDが重複しない
- カード定義全体がカードカタログ検証を通過している

---

## 20. シャッフル

シャッフルはバックエンドから注入された乱数生成器を使用する。

```ts
export function shuffle<T>(items: readonly T[], random: RandomSequence): T[];
```

元配列を直接変更せず、新しい配列を返すことを推奨する。

フロントエンドへは、確定後の山札情報だけを送信する。

ただし、山札内容および順番はプレイヤーに公開しない。

`initialRandomSeed`も非公開情報とし、対戦終了前にクライアントへ送信しない。

---

## 21. 初期手札

各プレイヤーは5枚引く。

5枚すべてがみなもとカードだった場合は、次の処理を行う。

1. 5枚を山札へ戻す
2. 再度シャッフルする
3. 5枚引く
4. 攻撃カードまたはサポートカードが1枚以上含まれるまで繰り返す

引き直しは最大20回とし、上限到達時は`INITIAL_HAND_SELECTION_FAILED`を返してゲーム状態を作成しない。

初期手札が確定した後に、みなもとカードを処理する。

みなもとカード1枚につき、対応属性の`total`を1増加させ、カードを捨て札へ移動する。

みなもとカードが抜けた分について、追加ドローは行わない。

---

## 22. コマンドモデル

効果入力に含められる値は、永続化と再送が可能なJSON値へ限定する。

```ts
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = {
  [key: string]: JsonValue;
};

export type EffectInput = {
  effectId: EffectId;
  targets: EffectTarget[];
  parameters?: JsonObject;
};
```

カード使用コマンドは、カード定義にある各効果について1件ずつ`EffectInput`を送る。対象不要の効果でも`targets`を空配列にする。`effectInputs`の配列順は解決順に使用しない。

エンジンは次を検証する。

- 同じ`effectId`の入力が重複していない
- カード定義に存在しない`effectId`が含まれていない
- カード定義に存在する効果の入力が不足していない
- 各入力の対象数、対象種別、所有者、領域が`TargetRule`と一致する
- `parameters`がJSON値だけで構成されている

すべてのコマンドは、共通情報を持つ。

```ts
export type BaseGameCommand = {
  commandId: CommandId;
  gameId: GameId;
  playerId: PlayerId;
  phaseSequence: number;
  clientStateVersion: number;
  issuedAt: number;
};
```

`issuedAt`はクライアント時刻であり、ゲーム判定には使用しない。

`phaseSequence`は、クライアントが操作対象としているフェーズの世代を表す。現在状態との完全一致を必須とし、過去ラウンドや過去フェーズから遅延したコマンドを拒否する。

`clientStateVersion`はクライアントが操作作成時に見ていた状態を表す。通常コマンドはバージョン不一致だけで拒否せず、サーバーの最新状態に対して対象、みなもと、カード位置などを再検証する。将来、特定スナップショットの計算結果へ依存するコマンドを追加する場合だけ、そのコマンド型に`expectedStateVersion`を追加して完全一致を要求する。

制限時間判定には、バックエンドがコマンドを受信したサーバー時刻を使用する。クライアントから`receivedAt`を受け取ってはならない。

```ts
export type ReceivedCommandEnvelope = {
  command: GameCommand | SystemGameCommand;
  receivedAt: number;
};
```

バックエンドは認証済みプレイヤーと`command.playerId`が一致することを確認してからエンジンへ渡す。

プレイヤーコマンドでは、個別条件より前に次を検証する。

1. 同じ`commandId`の処理結果が保存済みなら、その結果を再送する
2. `gameId`が現在状態と一致する
3. `playerId`が対戦参加者である
4. `phaseSequence`が現在状態と一致する
5. `clientStateVersion <= state.stateVersion`である
6. `receivedAt <= phaseDeadlineAt`である
7. コンテキストの3つのバージョンが状態と一致する

`clientStateVersion`が古いことだけを理由に拒否しない。

---

## 23. プレイヤーコマンド一覧

```ts
export type GameCommand =
  | PlaceAttackCardCommand
  | ChainAttackCardCommand
  | DiscardHandCardCommand
  | FinishPlacementCommand
  | PlaySupportCardCommand
  | FinishSupportCommand;
```

システム内部では、別途タイムアウトコマンドを使用する。

```ts
export type SystemGameCommand = HandlePhaseTimeoutCommand;
```

---

## 24. 攻撃カードの新規配置

```ts
export type PlaceAttackCardCommand = BaseGameCommand & {
  type: "PLACE_ATTACK_CARD";
  cardInstanceId: CardInstanceId;
  effectInputs: EffectInput[];
};
```

### 24.1 事前条件

- ゲームが`active`
- 現在フェーズが配置フェーズ
- コマンド送信者が現在の配置プレイヤー
- 制限時間内にサーバーが受信している
- 対象カードが送信者の手札に存在する
- 対象カードが攻撃カード
- 攻撃グループ数が5未満
- 配置後も対象属性のみなもとが不足しない
- `effectInputs`が対象カードの効果定義と一致する

### 24.2 状態変更

1. 元状態を変更しないローカルな仮状態を作る
2. 仮状態で手札から対象カードを削除する
3. 新しいグループIDを生成し、カード1枚の攻撃グループを作成する
4. 使用中みなもとを再計算する
5. カード定義順に`onPlay`効果の計画を作る
6. `continuous`効果の登録計画を作る
7. 全計画を仮状態へ適用し、不変条件を検証する
8. 成功時だけ状態とイベントを一括確定する

### 24.3 事後条件

- 対象カードは手札に存在しない
- 対象カードは1つの攻撃グループにだけ存在する
- 攻撃グループ数は5以下
- 使用可能みなもとは0以上

---

## 25. 攻撃カードの連鎖

```ts
export type ChainAttackCardCommand = BaseGameCommand & {
  type: "CHAIN_ATTACK_CARD";
  cardInstanceId: CardInstanceId;
  targetGroupId: AttackGroupId;
  effectInputs: EffectInput[];
};
```

### 25.1 事前条件

- ゲームが`active`
- 現在フェーズが配置フェーズ
- コマンド送信者が現在の配置プレイヤー
- 制限時間内
- 対象カードが送信者の手札に存在する
- 対象カードが攻撃カード
- 対象グループが送信者に属する
- 対象グループにカードが1枚以上存在する
- 対象カードとグループの属性が同じ
- グループ一番上のカードが、対象カードの定義IDを`chainableCardIds`に含む
- 追加後のグループコストでみなもと不足にならない
- `effectInputs`が対象カードの効果定義と一致する

### 25.2 状態変更

1. 元状態を変更しないローカルな仮状態を作る
2. 仮状態で対象カードを手札から削除する
3. 対象グループの`cardIds`末尾へ追加する
4. グループコストと使用可能みなもとを再計算する
5. カード定義順に`onPlay`効果の計画を作る
6. `continuous`効果の登録計画を作る
7. 全計画を仮状態へ適用し、不変条件を検証する
8. 成功時だけ状態とイベントを一括確定する

### 25.3 補足

- グループ数が5でも連鎖できる
- 連鎖枚数上限は設けない
- 一度追加したカードは通常操作では移動できない
- 作成済みグループの連鎖条件は再検証しない

---

## 26. 手札カードの破棄

```ts
export type DiscardHandCardCommand = BaseGameCommand & {
  type: "DISCARD_HAND_CARD";
  cardInstanceId: CardInstanceId;
};
```

### 26.1 事前条件

- ゲームが`active`
- 現在フェーズが送信者の配置フェーズ
- 制限時間内
- カードが送信者の手札に存在する
- カードが攻撃カードまたはサポートカード
- カードがみなもとカードではない

### 26.2 状態変更

1. 手札からカードを削除する
2. 捨て札末尾へカードを追加する
3. イベントを生成する

一度捨てたカードは取り戻せない。

---

## 27. 配置フェーズ終了

```ts
export type FinishPlacementCommand = BaseGameCommand & {
  type: "FINISH_PLACEMENT";
};
```

### 27.1 事前条件

- 現在フェーズが配置フェーズ
- コマンド送信者が現在の配置プレイヤー
- 制限時間内

### 27.2 状態変更

先攻配置フェーズの場合：

```text
firstPlayerPlacement
→ secondPlayerPlacement
```

後攻配置フェーズの場合：

```text
secondPlayerPlacement
→ support
```

フェーズ移行時に、新しいフェーズ開始時刻と期限を設定する。

フェーズ移行ごとに`phaseSequence`を1増加させる。

---

## 28. サポートカード使用

```ts
export type PlaySupportCardCommand = BaseGameCommand & {
  type: "PLAY_SUPPORT_CARD";
  cardInstanceId: CardInstanceId;
  effectInputs: EffectInput[];
};
```

### 28.1 事前条件

- ゲームが`active`
- 現在フェーズが`support`
- 制限時間内
- 送信者がサポート終了宣言をしていない
- 対象カードが送信者の手札に存在する
- 対象カードがサポートカード
- 指定対象がカード効果の条件を満たす
- 対象属性の使用可能みなもとがカードコスト以上

### 28.2 処理順

1. コマンドの基本条件を検証する
2. カード固有の発動条件を検証する
3. 効果IDごとの入力と対象を検証する
4. 必要みなもとを検証する
5. カードを手札から取り除く
6. サポートゾーンにカードを配置する
7. カード定義順に`onPlay`効果の解決計画を作る
8. `continuous`効果の登録計画を作る
9. 継続期間に応じたカード移動計画を作る
10. 全計画をローカルな仮状態へ適用する
11. みなもと状態と不変条件を検証する
12. 成功時だけ状態とイベントを一括確定する

### 28.3 `instant`

- コストは効果解決中だけ必要
- 効果解決後に捨て札へ移動
- 最終状態ではみなもとを予約しない

### 28.4 `untilRoundEnd`

- サポートゾーンに残る
- 勝敗判定終了までコストを予約する
- 勝敗判定後に捨て札へ移動する

### 28.5 `permanent`

- サポートゾーンに残る
- 除去されるまでコストを予約する
- 場を離れた場合に効果を終了する

---

## 29. サポート終了

```ts
export type FinishSupportCommand = BaseGameCommand & {
  type: "FINISH_SUPPORT";
};
```

### 29.1 事前条件

- 現在フェーズが`support`
- 制限時間内
- 送信者がまだ終了宣言していない

### 29.2 状態変更

- 送信者を`supportFinishedBy`へ追加する
- 終了宣言後は、同ラウンド中のサポートカード使用を禁止する
- 終了宣言は取り消せない

双方が終了宣言した場合は、直ちにラウンド解決処理へ進む。

片方だけが終了した場合、もう片方は時間内であれば何枚でもサポートカードを使用できる。

ラウンド解決へ移るときは`phaseSequence`を1増加させる。

---

## 30. フェーズタイムアウト

```ts
export type HandlePhaseTimeoutCommand = {
  type: "HANDLE_PHASE_TIMEOUT";
  gameId: GameId;
  phaseSequence: number;
};
```

このコマンドはバックエンドだけが実行できる。

`phaseSequence`が現在状態と一致しないタイムアウトコマンドは、過去フェーズのアラームとして何も変更せず終了する。

### 30.1 配置フェーズのタイムアウト

- 現在確定済みの配置を維持する
- 現在確定済みの捨て札操作を維持する
- 未操作の手札をそのまま残す
- 現在の配置フェーズを終了する
- 次のフェーズへ進む

### 30.2 サポートフェーズのタイムアウト

- 新規サポートコマンドの受付を停止する
- 制限時間内に受理済みのコマンドは最後まで解決する
- ラウンド解決処理へ進む

### 30.3 期限判定

クライアント上の表示時刻ではなく、`ReceivedCommandEnvelope.receivedAt`を使用する。

```text
receivedAt <= phaseDeadlineAt
```

の場合だけ、コマンドを受理できる。

---

## 31. コマンド実行結果

```ts
export type ExecuteCommandResult =
  | {
      accepted: true;
      state: GameState;
      events: GameEventEnvelope[];
    }
  | {
      accepted: false;
      state: GameState;
      error: GameCommandError;
    };
```

拒否されたコマンドによって、ゲーム状態を変更してはならない。

---

## 32. コマンドの原子性

1つのコマンドは、完全に成功するか、まったく状態を変更しないかのどちらかとする。

効果処理中にエラーが発生した場合は、次をすべて元の状態へ戻す。

- カード位置
- みなもと
- スタミナ
- 攻撃力効果
- アクティブ効果
- 捨て札
- サポートゾーン
- 攻撃グループ

部分的な成功状態を保存してはならない。

実装上は、元状態を直接変更せず、新しい状態を生成して最後に確定する。これは推奨ではなく、効果ハンドラーを含むすべてのコマンド実装が守る契約とする。

開発・テストでは入力状態を再帰的に`deepFreeze`し、意図しない変更を検出する。TypeScriptの`Readonly`だけを実行時の原子性保証としてはならない。

---

## 33. コマンドの重複防止

通信再送による二重実行を防ぐため、コマンドIDを使用する。

同じ`commandId`を持つコマンドを再度受信した場合は、ゲーム状態を再変更しない。

バックエンドは、受理・拒否を問わず最初の実行結果をゲーム終了まで取得できる冪等性ストアへ、認証済みプレイヤーと完全なコマンド内容を結び付けて保存する。同じ認証済みプレイヤーから同一内容が再送された場合だけ最初の結果を返す。別プレイヤーまたは異なる内容が同じ`commandId`を使用した場合は、保存済みの公開状態を返さず競合として拒否する。

`GameState.processedCommandIds`は、受理済みコマンドの二重適用を防ぐ補助情報とする。進行中ゲームでは削除しない。ゲーム終了後の保持期限はバックエンドの保存方針で決定する。

重複確認は、フェーズ、期限、カード位置の検証より前に行う。これにより、最初は成功したコマンドが再送時の新しい状態を理由に失敗扱いへ変わることを防ぐ。

---

## 34. サポートコマンドの競合

サポートフェーズ中のコマンドは、バックエンドが受信した順番で1件ずつ処理する。

```text
コマンドAを受信
↓
Aを最新状態へ適用
↓
新しい状態を保存
↓
コマンドBを最新状態へ適用
```

後続コマンドは、先行コマンド適用後の最新状態に対して再検証する。

先行効果によって対象が消えている場合、後続コマンドを拒否する。

拒否された場合：

- カードは手札に残る
- みなもとは使用しない
- 効果は発生しない

---

## 35. カード効果インターフェース

```ts
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type EffectContext = {
  state: DeepReadonly<GameState>;
  rules: Readonly<GameRules>;
  cardCatalog: CardCatalog;
  sourceCardInstanceId: CardInstanceId;
  sourceCardDefinitionId: CardDefinitionId;
  ownerId: PlayerId;
  input: DeepReadonly<EffectInput>;
  currentRound: number;
};
```

```ts
export type ActiveEffectDraft = Omit<
  ActiveEffect,
  "effectInstanceId" | "appliedSequence" | "appliedRound"
>;

export type EffectPlanOperation =
  | {
      type: "CHANGE_STAMINA";
      playerId: PlayerId;
      amount: number;
    }
  | {
      type: "REDUCE_MANA";
      playerId: PlayerId;
      attribute: Attribute;
      requestedAmount: number;
    }
  | {
      type: "DRAW_CARDS";
      playerId: PlayerId;
      count: number;
    }
  | {
      type: "REMOVE_ATTACK_GROUP";
      groupId: AttackGroupId;
    }
  | {
      type: "REMOVE_SUPPORT_CARD";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ADD_ACTIVE_EFFECT";
      effect: ActiveEffectDraft;
    };

export type EffectResolutionPlan = {
  readonly operations: readonly EffectPlanOperation[];
};
```

```ts
export type EffectValidationErrorCode =
  | "SOURCE_CARD_NOT_FOUND"
  | "SOURCE_CARD_NOT_ON_EXPECTED_ZONE"
  | "INVALID_ACTIVATION_TYPE"
  | "INVALID_EFFECT_INPUT"
  | "INVALID_TARGET_COUNT"
  | "INVALID_TARGET_TYPE"
  | "INVALID_TARGET_OWNER"
  | "TARGET_NOT_FOUND"
  | "TARGET_NO_LONGER_VALID"
  | "INSUFFICIENT_MANA"
  | "EFFECT_CONDITION_NOT_MET"
  | "EFFECT_CONFIG_INVALID"
  | "RESULTING_STATE_INVALID"
  | "EFFECT_HANDLER_NOT_FOUND"
  | "EFFECT_PLANNING_FAILED";

export type EffectValidationError = {
  code: EffectValidationErrorCode;
  message: string;
  details?: JsonObject;
};

export type EffectValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: EffectValidationError[];
    };

export interface CardEffectHandler {
  validateDefinition(
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectValidationResult;

  validate(
    context: EffectContext,
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectValidationResult;

  plan(
    context: EffectContext,
    definition: DeepReadonly<CardEffectDefinition>,
  ): EffectResolutionPlan;
}
```

`validateDefinition`はカードカタログ読み込み時に呼び出し、設定値とハンドラー固有の組み合わせを検証する。効果ハンドラーは`GameState`、カード配列、イベント列、シーケンスを直接変更しない。共通効果は効果定義の`type`、カスタム効果は`handlerId`に対応するハンドラーへ委譲する。

```ts
export type EffectRegistry = Record<string, CardEffectHandler>;
```

エンジンはカード定義順に各計画を作成する。後続効果を計画するときは、先行計画をローカルな仮状態へ適用した結果を読み取り専用で渡す。すべての計画が成功した後に、エンジンが操作を新しい状態へ一括適用し、効果ID・シーケンスの採番、ドメインイベント生成、不変条件検証を行う。

ハンドラーが返した操作も信頼せず、操作種別、数値、参照ID、対象領域、適用後のみなもとをエンジンが検証する。未対応の状態変更が必要な効果を追加するときは、暗黙の直接変更を許可せず、`EffectPlanOperation`と`EngineSemanticsVersion`を拡張する。

計画作成中の例外、仮適用、最終適用のいずれかが失敗した場合は、元の`GameState`をそのまま返す。ゲームエンジン本体に、カード名ごとの巨大な`switch`文を直接記述しない。

---

## 36. みなもと減少効果

みなもと減少効果は、対象属性のみなもと総量を永続的に減少させる。

実際の減少量は次の式で求める。

```ts
actualReduction = Math.max(
  0,
  Math.min(requestedReduction, totalMana - reservedMana, totalMana - 1),
);
```

### 36.1 条件

- みなもと総量を0にしない
- みなもと総量を現在の予約量未満にしない
- 指定量を減らせない場合は、減らせる分だけ減らす
- 減少量が0でも、カード固有ルールで禁止されていなければ効果解決済みとして扱える
- 既存カードを停止させる状態は作らない

みなもと総量が0の属性に対しては、減少量を0とする。

---

## 37. 攻撃グループ除去

初期実装では、攻撃カード除去はグループ全体を対象とする。

```ts
export function removeAttackGroup(
  state: GameState,
  groupId: AttackGroupId,
): GameState;
```

### 37.1 処理

1. 対象グループの存在を確認する
2. グループに含まれるカードを上から順番に捨て札へ移動する
3. 各カードを効果元とする継続効果を削除する
4. 攻撃グループを削除する
5. みなもとの予約量を再計算する
6. グループ枠を1つ解放する
7. イベントを生成する

グループ除去後、過去の連鎖関係を再検証する必要はない。

---

## 38. サポートカード除去

サポートカードが場から離れた場合は、次の処理を行う。

1. サポートゾーンからカードを削除する
2. 捨て札へ移動する
3. 対象カードを効果元とする継続効果を削除する
4. みなもとの予約量を再計算する
5. イベントを生成する

---

## 39. 攻撃力計算

攻撃力計算は、次の3階層で行う。

1. カード単体
2. 攻撃グループ
3. プレイヤー総パワー

---

## 40. カード単体の攻撃力

```ts
export function calculateCardPower(
  state: GameState,
  cardInstanceId: CardInstanceId,
): number;
```

計算順は次のとおり。

1. 基礎攻撃力を取得する
2. 最新の上書き効果を適用する
3. 加算・減算効果を合計して適用する
4. 乗算効果をすべて乗算して適用する
5. 小数点以下を切り捨てる
6. 最低値1を適用する

```ts
const overwritten = latestOverwrite?.value ?? basePower;

const added = overwritten + additiveEffectsTotal;

const multiplied = added * multiplicativeEffectsProduct;

const floored = Math.floor(multiplied);

const finalPower = Math.max(1, floored);
```

複数の上書き効果がある場合は、`appliedSequence`が最も大きい効果を使用する。

---

## 41. グループ攻撃力

```ts
export function calculateGroupPower(
  state: GameState,
  groupId: AttackGroupId,
): number;
```

計算順は次のとおり。

1. グループ内の各カードの最終攻撃力を計算する
2. すべて合計する
3. 最新のグループ上書き効果を適用する
4. グループ加算・減算効果を適用する
5. グループ乗算効果を適用する
6. 小数点以下を切り捨てる
7. 最低値0を適用する

```ts
groupPower = Math.max(0, Math.floor(calculatedGroupPower));
```

---

## 42. プレイヤー総パワー

```ts
export function calculateTotalPower(
  state: GameState,
  playerId: PlayerId,
): number;
```

計算順は次のとおり。

1. プレイヤーの各攻撃グループの攻撃力を計算する
2. すべて合計する
3. 最新の総パワー上書き効果を適用する
4. 総パワー加算・減算効果を適用する
5. 総パワー乗算効果を適用する
6. 小数点以下を切り捨てる
7. 最低値0を適用する

```ts
totalPower = Math.max(0, Math.floor(calculatedTotalPower));
```

---

## 43. ラウンド解決

サポートフェーズ終了後、次の処理を自動的に行う。

```text
サポートフェーズ終了
↓
双方の総パワー計算
↓
総パワー差をスタミナへ反映
↓
通常勝敗判定
↓
untilRoundEnd効果の終了
↓
第30ラウンド判定
↓
場の整理
↓
山札切れ事前判定
↓
手札補充
↓
次ラウンド開始
```

通常勝敗または最大ラウンド判定で決着した場合は、補充処理へ進まない。

---

## 44. スコア計算

```ts
export type RoundPowerResult = {
  playerPowers: Record<PlayerId, number>;
  difference: number;
  higherPowerPlayerId: PlayerId | null;
};
```

双方の総パワーが異なる場合：

```text
低い側のスタミナ
-= 総パワー差
```

双方が同じ場合：

```text
スタミナ変化なし
```

スタミナは0未満になってよい。

---

## 45. 通常勝敗判定

スコア計算とスタミナ反映が完了した後に1回だけ判定する。

```ts
if (playerA.stamina <= 0 && playerB.stamina <= 0) {
  return draw;
}

if (playerA.stamina <= 0) {
  return playerBWin;
}

if (playerB.stamina <= 0) {
  return playerAWin;
}

return noWinner;
```

サポートフェーズ中にスタミナが0以下になっても、即座にはゲームを終了しない。

---

## 46. 第30ラウンド判定

第30ラウンドでは、次の順番で判定する。

1. サポートフェーズ終了
2. 総パワー計算
3. スタミナ反映
4. 通常勝敗判定
5. 通常勝敗がなければスタミナ比較
6. スタミナが同じなら最終総パワー比較
7. 総パワーも同じなら引き分け

第30ラウンド終了後は、手札補充へ進まない。

最終総パワー比較には、`untilRoundEnd`効果を含めて手順2で確定した`RoundPowerResult`を使用する。効果終了後の盤面から総パワーを再計算してはならない。

---

## 47. 効果終了処理

`untilRoundEnd`効果は、スコア計算および通常勝敗判定が終了した後に削除する。

対象サポートカードは、サポートゾーンから捨て札へ移動する。

ゲームがそのラウンドで終了する場合でも、効果の有効期限は終了したものとして扱う。

UIで最終盤面を表示するために必要な情報は、ゲームイベントまたはラウンド結果へ保持する。

---

## 48. 場の整理

通常ラウンド終了時は、次を行う。

- 攻撃グループを残す
- 攻撃カードを残す
- `permanent`サポートカードを残す
- `untilRoundEnd`サポートカードを捨て札へ移動する
- 終了した効果を削除する
- みなもと予約量を再計算する
- サポート終了状態をリセットする

---

## 49. 山札切れ事前判定

手札補充フェーズ開始時に、どちらか一方または双方の山札が0枚の場合は、補充を行わずゲームを終了する。

```ts
if (playerA.deck.length === 0 || playerB.deck.length === 0) {
  resolveDeckOut();
}
```

手札が5枚存在していても、山札が0枚であれば山札切れとする。

---

## 50. 山札切れ時の勝敗

山札切れ時は、現在スタミナを比較する。

- スタミナが高いプレイヤーの勝利
- スタミナが同じ場合は引き分け

総パワー比較は行わない。

---

## 51. 通常の手札補充

山札切れ事前判定で決着しなかった場合、双方の手札を補充する。

各プレイヤーについて次を行う。

```ts
requestedDraw = Math.max(0, 5 - hand.length);

actualDraw = Math.min(requestedDraw, deck.length);
```

山札先頭から`actualDraw`枚を手札へ移動する。

双方の補充は、同じ自動処理フェーズ内で実行する。

---

## 52. 補充時のみなもと処理

補充で引いたカードをいったん手札へ追加する。

その後、今回引いたみなもとカードを処理する。

みなもとカードごとに：

1. 対応属性の`total`を1増加する
2. 手札から削除する
3. 捨て札末尾へ追加する

みなもとカードが抜けても追加ドローは行わない。

補充中に山札が0枚になっても、その場では山札切れとしない。

次回の手札補充フェーズ開始時に判定する。

---

## 53. カード効果によるドロー

カード効果によるドロー枚数は、次の最小値とする。

```ts
actualDraw = Math.min(effectDrawCount, 5 - hand.length, deck.length);
```

引いたみなもとカードは、即座に次の処理を行う。

- 対応属性のみなもと総量を1増加
- 捨て札へ移動
- 追加ドローなし

カード効果によるドローで山札が0枚になっても、即座には山札切れとしない。

---

## 54. 次ラウンドの先攻

直前ラウンドの最終総パワーを比較する。

- 総パワーが高いプレイヤーが次ラウンド先攻
- 同点の場合は、直前ラウンドの先攻と後攻を入れ替える

```ts
if (powerA > powerB) {
  nextFirstPlayer = playerA;
} else if (powerB > powerA) {
  nextFirstPlayer = playerB;
} else {
  nextFirstPlayer = previousSecondPlayer;
}
```

ダメージ軽減や無効化が存在しても、最終総パワーを基準とする。

---

## 55. 次ラウンド開始

次ラウンド開始時は、次を行う。

1. `round`を1増加する
2. 次の先攻・後攻を設定する
3. `supportFinishedBy`を空にする
4. フェーズを`firstPlayerPlacement`にする
5. `phaseSequence`を1増加させる
6. 開始時刻を設定する
7. ルール値に基づいて期限を設定する
8. ラウンド開始イベントを生成する

---

## 56. ゲーム終了状態

```ts
export type GameWinner =
  | {
      type: "player";
      playerId: PlayerId;
      reason: "stamina" | "deckOut" | "maxRoundStamina" | "maxRoundPower";
    }
  | {
      type: "draw";
      reason: "bothStaminaZero" | "deckOutEqualStamina" | "maxRoundEqual";
    };
```

ゲーム終了時は：

- `status`を`finished`にする
- `phase`を`finished`にする
- `phaseSequence`を1増加させる
- `phaseDeadlineAt`を`null`にする
- `winner`を設定する
- ゲーム終了イベントを生成する

---

## 57. ラウンド結果

```ts
export type RoundResult = {
  round: number;
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;

  totalPowers: Record<PlayerId, number>;

  staminaBefore: Record<PlayerId, number>;
  staminaAfter: Record<PlayerId, number>;

  higherPowerPlayerId: PlayerId | null;
  nextFirstPlayerId: PlayerId | null;
};
```

第30ラウンドやゲーム終了時には、`nextFirstPlayerId`を`null`にする。

---

## 58. ゲームイベント

```ts
export type GameEventEnvelope = {
  sequence: number;
  stateVersion: number;
  occurredAt: number;
  event: DomainEvent;
};
```

イベントは生成順に連番を持つ。

### 58.1 主なイベント

```ts
export type GameProgressEvent =
  | {
      type: "GAME_STARTED";
      firstPlayerId: PlayerId;
    }
  | {
      type: "ROUND_STARTED";
      round: number;
      firstPlayerId: PlayerId;
      secondPlayerId: PlayerId;
    }
  | {
      type: "PHASE_CHANGED";
      phase: GamePhase;
      phaseSequence: number;
      deadlineAt: number | null;
    }
  | {
      type: "CARDS_DRAWN";
      playerId: PlayerId;
      reason: "initial" | "refill" | "effect";
      cardInstanceIds: CardInstanceId[];
    }
  | {
      type: "MANA_GAINED";
      playerId: PlayerId;
      attribute: Attribute;
      amount: number;
    }
  | {
      type: "CARD_DISCARDED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ATTACK_GROUP_CREATED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "CARD_CHAINED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ATTACK_GROUP_REMOVED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceIds: CardInstanceId[];
    }
  | {
      type: "SUPPORT_CARD_PLAYED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "SUPPORT_FINISHED";
      playerId: PlayerId;
    }
  | {
      type: "SUPPORT_PHASE_ENDED";
    }
  | {
      type: "POWER_CALCULATED";
      playerPowers: Record<PlayerId, number>;
    }
  | {
      type: "STAMINA_CHANGED";
      playerId: PlayerId;
      before: number;
      after: number;
    }
  | {
      type: "ROUND_RESOLVED";
      result: RoundResult;
    }
  | {
      type: "GAME_FINISHED";
      winner: GameWinner;
    };
```

```ts
export type ActiveEffectRemovalReason =
  | "durationEnded"
  | "sourceLeftField"
  | "targetLeftField"
  | "gameFinished";

export type CardEffectEvent =
  | {
      type: "CARD_EFFECT_ACTIVATED";
      sourceCardInstanceId: CardInstanceId;
      effectId: EffectId;
      ownerId: PlayerId;
    }
  | {
      type: "CARD_EFFECT_RESOLVED";
      sourceCardInstanceId: CardInstanceId;
      effectId: EffectId;
    }
  | {
      type: "ACTIVE_EFFECT_ADDED";
      activeEffect: ActiveEffect;
    }
  | {
      type: "ACTIVE_EFFECT_REMOVED";
      effectInstanceId: EffectInstanceId;
      reason: ActiveEffectRemovalReason;
    }
  | {
      type: "MANA_REDUCED";
      playerId: PlayerId;
      attribute: Attribute;
      requestedAmount: number;
      actualAmount: number;
    }
  | {
      type: "SUPPORT_CARD_REMOVED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    };

export type DomainEvent = GameProgressEvent | CardEffectEvent;
```

カード移動、スタミナ変更、グループ除去など、進行処理と効果処理で同じ意味を持つイベントは`GameProgressEvent`を共用し、同じ`type`を持つ別形状のイベントを作らない。

`CARDS_DRAWN.cardInstanceIds`はサーバー内部イベントに必ず保持する。相手向け公開イベントへ変換するときだけ枚数へ置換する。これにより、イベント確定後に過去状態との差分から引いたカードを推測する必要がなくなる。

---

## 59. 状態バージョン

受理されたコマンド、または単独で永続化される自動処理トランザクションが完了するたびに、`stateVersion`を1増加させる。1コマンド内で複数の自動フェーズを進めても、状態とイベントを一括保存する場合は1トランザクションとして1回だけ増加させる。

```text
状態更新前：version 10
状態更新後：version 11
```

同じトランザクションで生成したイベントには、確定後の同じ`stateVersion`を付与する。トランザクション内の順番は`sequence`で表す。

フロントエンドは、古い状態やイベントを無視するために`stateVersion`と`sequence`を利用できる。

---

## 60. UIアニメーションとの分離

バックエンドは、UIアニメーションの完了を待たない。

例：

```text
バックエンド
サポート終了
→ 総パワー計算
→ スタミナ変更
→ 補充
→ 次ラウンド状態確定
```

フロントエンド：

```text
POWER_CALCULATED
→ パワー表示アニメーション

STAMINA_CHANGED
→ スタミナ減少アニメーション

CARDS_DRAWN
→ 補充アニメーション

ROUND_STARTED
→ ラウンド開始表示
```

フロントエンドでは、次を分離して管理する。

- サーバー上の最新状態
- 現在画面に表示している状態
- 未再生のゲームイベント
- UI入力ロック状態

UI演出が失敗または省略された場合でも、サーバー上のゲーム状態には影響させない。

---

## 61. プレイヤー向け公開状態

ゲームエンジンは、内部状態をそのままクライアントへ送信しない。

```ts
export type VisibleCardInstance = Pick<
  CardInstance,
  "instanceId" | "definitionId" | "ownerId"
>;

export type VisibleAttackGroup = Omit<AttackGroup, "cardIds"> & {
  cards: VisibleCardInstance[];
};

export type PublicPlayerState = {
  playerId: PlayerId;
  stamina: number;
  handCount: number;
  deckCount: number;
  discardPile: VisibleCardInstance[];
  attackGroups: VisibleAttackGroup[];
  supportZone: VisibleCardInstance[];
  mana: ManaState;
  activeEffects: ActiveEffect[];
  supportFinished: boolean;
};

export type PlayerGameView = {
  gameId: GameId;
  rulesetVersion: RulesetVersion;
  cardCatalogVersion: CardCatalogVersion;
  stateVersion: number;
  status: GameStatus;
  round: number;
  phase: GamePhase;
  phaseSequence: number;
  phaseDeadlineAt: number | null;
  firstPlayerId: PlayerId;
  secondPlayerId: PlayerId;
  viewerPlayerId: PlayerId;
  self: PublicPlayerState & {
    hand: VisibleCardInstance[];
  };
  opponent: PublicPlayerState;
  lastRoundResult: RoundResult | null;
  winner: GameWinner | null;
};
```

クライアントは`cardCatalogVersion`に対応する公開カードカタログを取得し、`definitionId`から表示情報を解決する。公開カードカタログは内部`CardCatalog`と別のDTOとし、カード名、公開ルール文章、属性、コストなど表示に必要な情報だけを含める。`handlerId`、カスタム`config`、未公開の内部条件をクライアントへ送らない。

```ts
export function createPlayerView(
  state: GameState,
  viewerPlayerId: PlayerId,
): PlayerGameView;
```

イベントも閲覧者別に投影する。

```ts
export type PlayerVisibleCardsDrawnEvent = {
  type: "CARDS_DRAWN";
  playerId: PlayerId;
  reason: "initial" | "refill" | "effect";
  count: number;
  cardInstanceIds?: CardInstanceId[];
};

export type PlayerVisibleEvent =
  | Exclude<DomainEvent, { type: "CARDS_DRAWN" }>
  | PlayerVisibleCardsDrawnEvent;

export type PlayerVisibleEventEnvelope = Omit<GameEventEnvelope, "event"> & {
  event: PlayerVisibleEvent;
};

export function projectEventForPlayer(
  envelope: GameEventEnvelope,
  viewerPlayerId: PlayerId,
): PlayerVisibleEventEnvelope | null;
```

`CARDS_DRAWN`は、ドローした本人向けだけ`cardInstanceIds`を含め、相手向けは`count`だけを含める。非公開情報を除去できないイベントは`null`として配信しない。

### 61.1 自分に見える情報

- 自分の手札内容
- 自分の手札枚数
- 自分の山札枚数
- 自分のバトルゾーン
- 自分のみなもと
- 自分の捨て札
- 自分の有効効果

### 61.2 相手に見える情報

- 相手の手札枚数
- 相手の山札枚数
- 相手のバトルゾーン
- 相手のみなもと
- 相手の捨て札内容と順番
- 相手の有効効果

### 61.3 非公開情報

- 相手の手札内容
- 双方の山札内容
- 双方の山札順序
- 初期乱数seed
- 内部処理用情報
- 未公開のカード効果情報

---

## 62. エラーコード

```ts
export type GameCommandErrorCode =
  | "GAME_ID_MISMATCH"
  | "GAME_NOT_ACTIVE"
  | "INVALID_PHASE"
  | "NOT_CURRENT_PLAYER"
  | "PHASE_SEQUENCE_MISMATCH"
  | "CLIENT_STATE_VERSION_AHEAD"
  | "PHASE_DEADLINE_EXPIRED"
  | "INVALID_COMMAND_TIMESTAMP"
  | "CONTEXT_VERSION_MISMATCH"
  | "CARD_NOT_FOUND"
  | "CARD_NOT_IN_HAND"
  | "INVALID_CARD_TYPE"
  | "ATTACK_GROUP_NOT_FOUND"
  | "ATTACK_GROUP_LIMIT_REACHED"
  | "ATTRIBUTE_MISMATCH"
  | "CHAIN_NOT_ALLOWED"
  | "INSUFFICIENT_MANA"
  | "INVALID_TARGET"
  | "INVALID_EFFECT_INPUT"
  | "SUPPORT_ALREADY_FINISHED"
  | "HAND_LIMIT_REACHED"
  | "EFFECT_VALIDATION_FAILED"
  | "EFFECT_PLANNING_FAILED"
  | "COMMAND_ALREADY_PROCESSED"
  | "INTERNAL_INVARIANT_VIOLATION";
```

```ts
export type GameCommandError = {
  code: GameCommandErrorCode;
  message: string;
  details?: JsonObject;
};
```

エラーの`message`をゲームロジック判定には使用しない。

---

## 63. 状態不変条件

ゲーム初期化後、すべてのコマンド処理後、自動処理の確定前に、次の条件を検証する。

### 63.1 カード位置

各カードインスタンスは、必ず次のいずれか1か所だけに存在する。

- 山札
- 手札
- 捨て札
- 攻撃グループ
- サポートゾーン

同じカードが複数領域に存在してはならない。

さらに次を満たす。

- すべての領域にあるIDが`cardInstances`に存在する
- `cardInstances`の全要素が必ずいずれか1領域に存在する
- カードの`ownerId`と、そのカードを保持するプレイヤーまたは場の所有者が一致する
- `definitionId`が固定された`CardCatalogVersion`のカタログに存在する
- 対戦開始後に`cardInstances`の追加・削除を行わない
- `cardInstances`の件数が`rules.playerCount * rules.deckSize`と一致する
- Recordのキーと各`CardInstance.instanceId`が一致する

### 63.1.1 プレイヤー

- `players`の件数が`rules.playerCount`と一致する
- `playerOrder`、`firstPlayerId`、`secondPlayerId`に未知または重複したプレイヤーIDがない
- `firstPlayerId`と`secondPlayerId`が異なる
- `supportFinishedBy`に未知または重複したプレイヤーIDがない

### 63.2 攻撃グループ

- 各プレイヤー最大5グループ
- 空のグループは存在しない
- すべてのカードが同じ属性
- グループIDは一意
- カードインスタンスIDは重複しない

### 63.3 みなもと

属性ごとに：

```text
total >= 0
reserved >= 0
available >= 0
reserved <= total
```

### 63.4 手札

通常の処理完了状態では、手札枚数は5以下とする。

### 63.5 イベント

- イベントシーケンスは増加する
- 同一ゲーム内で重複しない

### 63.6 ゲーム終了

`status === "finished"`の場合：

- `phase === "finished"`
- `winner !== null`
- `phaseDeadlineAt === null`

すべての状態で`phaseSequence`は1以上の整数とし、フェーズ遷移以外では変更しない。

### 63.7 バージョンとシーケンス

- 状態の3つのバージョンが`GameEngineContext`と一致する
- `stateVersion`、`phaseSequence`、`nextEffectSequence`、`nextEventSequence`は0以上の安全な整数
- 発行済みの効果・イベントシーケンスより、対応する次シーケンスが大きい
- `processedCommandIds`に重複がない

---

## 64. 状態検証関数

```ts
export type StateValidationIssue = {
  code: string;
  message: string;
  details?: JsonObject;
};

export type StateValidationResult =
  | { valid: true }
  | {
      valid: false;
      issues: StateValidationIssue[];
    };

export function validateGameState(
  state: GameState,
  context: GameEngineContext,
): StateValidationResult;
```

開発中およびテストでは、すべてのコマンド適用後に状態検証を実行する。

本番環境では、性能を確認した上で常時実行または重要箇所のみ実行する。

不変条件違反が発生した場合は、状態を保存せず、内部エラーとして扱う。

---

## 65. 永続化境界

バックエンドは、次の単位で排他的に処理する。

```text
現在状態を読み込む
↓
状態に固定された3つのバージョンからGameEngineContextを解決する
↓
コマンドをゲームエンジンへ渡す
↓
新状態とイベントを取得
↓
新状態とイベントを同一トランザクションで保存
↓
クライアントへ配信
```

サポートフェーズ中の複数操作を並列で状態へ適用してはならない。

常に最新のカードカタログや効果ハンドラーを進行中ゲームへ適用してはならない。バックエンドは`RulesetVersion`、`CardCatalogVersion`、`EngineSemanticsVersion`に対応する不変な`GameEngineContext`を解決できなければ、そのゲームの更新を停止して運用エラーとして扱う。

Durable Objectを利用する場合も、ゲームエンジン自体にはDurable ObjectのAPIを持ち込まない。

---

## 66. タイマー管理

ゲームエンジンは、フェーズ開始時刻と期限を状態に保持する。

```ts
phaseStartedAt: number;
phaseDeadlineAt: number | null;
```

実際に期限到達時の処理を呼び出す責務はバックエンドが持つ。

バックエンドはアラームまたはタイマー処理によって、期限到達後に`HANDLE_PHASE_TIMEOUT`を実行する。

再接続しても期限は延長しない。

---

## 67. 再接続

再接続処理はバックエンドの責務とする。

再接続時は、次をクライアントへ送信する。

- 最新のプレイヤー向け公開状態
- 現在の状態バージョン
- 現在フェーズ
- フェーズ期限
- 必要に応じて未確認イベント

再接続によってゲームエンジンの状態を変更してはならない。

---

## 68. テスト方針

最低限、次のテストを作成する。

### 68.1 デッキ検証

- 正常な30枚デッキ
- 29枚または31枚
- みなもと不足
- みなもと超過
- 攻撃カード不足
- サポートカード超過
- 同名カード3枚
- 属性不足

### 68.2 初期化

- 初期スタミナ25
- 初期手札5枚
- すべてみなもとの場合の引き直し
- みなもとカードの自動処理
- 第1ラウンド先攻の乱数決定
- 同じseedで同じ山札順、先攻、カードIDになる
- 保存前に初期化を再実行しても同じ結果になる

### 68.3 攻撃配置

- 新規グループ作成
- 5グループ上限
- 5グループ時の連鎖
- 属性違いの連鎖拒否
- 連鎖条件不一致
- みなもと不足
- 配置後の移動不可

### 68.4 サポート

- 受信順処理
- 不正対象
- `instant`
- `untilRoundEnd`
- `permanent`
- 終了宣言後の使用拒否
- 双方終了時の自動解決
- 60秒タイムアウト

### 68.5 みなもと

- グループ最大コスト
- 最大コスト変更時の再計算
- グループ除去時の解放
- サポート除去時の解放
- 減らせる分だけ減らす
- 総量0を防ぐ
- 使用量未満への減少を防ぐ

### 68.6 パワー計算

- 上書き
- 加算
- 乗算
- 小数点以下切り捨て
- カード最低1
- グループ最低0
- 総パワー最低0
- 最新上書き優先

### 68.7 勝敗

- 片方のスタミナ0
- 双方スタミナ0
- 総パワー同点
- 山札切れ
- 山札切れ時スタミナ同点
- 第30ラウンドのスタミナ比較
- 第30ラウンドの総パワー比較
- 完全同点

### 68.8 タイムアウト・再送

- 配置時間切れ
- サポート時間切れ
- 期限後コマンド拒否
- 同一コマンドIDの再送
- サポートコマンドの競合
- 前ラウンドから遅延した同名フェーズのコマンド拒否
- 過去フェーズのタイムアウトコマンド無視
- `clientStateVersion`が古くても最新状態で再検証されること

### 68.9 カタログ・カードインスタンス

- 60枚すべてのカード実体を一意に登録する
- 全カードが常に1領域だけに存在する
- 存在しないカード定義IDを拒否する
- ID生成衝突時に初期化またはコマンド全体を失敗させる
- 状態とコンテキストのバージョン不一致を拒否する
- 古いバージョンのカタログと効果ハンドラーで進行中ゲームを再開できる

### 68.10 効果入力・原子性・公開情報

- 効果IDごとに異なる対象を正しく割り当てる
- 重複、未知、不足した`EffectInput`を拒否する
- ハンドラーが入力状態を変更できない
- 計画途中の例外で元状態が参照同値または構造同値のまま残る
- 複数効果をカード定義順で仮適用する
- 本人向けドローイベントだけがカードIDを含む
- 相手向け状態とイベントから手札内容、山札内容、内部効果設定を取得できない

---

## 69. 推奨公開API

```ts
export function initializeGame(
  input: InitializeGameInput,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): InitializeGameResult;
```

```ts
export function executeCommand(
  state: GameState,
  envelope: ReceivedCommandEnvelope,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): ExecuteCommandResult;
```

```ts
export function validateDeck(
  deckDefinitionIds: CardDefinitionId[],
  cardCatalog: CardCatalog,
  rules: Readonly<GameRules>,
): DeckValidationResult;
```

```ts
export function createPlayerView(
  state: GameState,
  viewerPlayerId: PlayerId,
  context: GameEngineContext,
): PlayerGameView;
```

```ts
export function validateGameState(
  state: GameState,
  context: GameEngineContext,
): StateValidationResult;
```

```ts
export function projectEventForPlayer(
  envelope: GameEventEnvelope,
  viewerPlayerId: PlayerId,
): PlayerVisibleEventEnvelope | null;
```

---

## 70. 実装上の原則

ゲームエンジン実装では、次の原則を守る。

1. バックエンド状態を唯一の正とする
2. フロントエンドから計算済み結果を受け取らない
3. フロントエンドから送るのは操作意図だけとする
4. すべての操作をサーバー側で再検証する
5. 同じ状態と入力から同じ結果を生成する
6. コマンドは原子的に処理する
7. 効果処理中の部分更新を残さない
8. みなもとは現在盤面から再計算する
9. UIアニメーションをゲーム進行条件にしない
10. カード固有効果をゲーム進行ロジックから分離する
11. 乱数、時刻、ID生成を外部注入する
12. すべての状態変更から順序付きイベントを生成する
13. ゲーム状態をクライアントへそのまま公開しない
14. 不変条件違反の状態を永続化しない
15. インフラストラクチャ固有コードをゲームエンジンへ持ち込まない
