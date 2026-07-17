# カード効果仕様書

## 1. 文書概要

本書は、「基本ゲームルール定義書」および「ゲームエンジン仕様書」に基づき、カード固有効果の定義方法、発動条件、対象選択、検証、解決順序、継続期間およびゲーム状態への反映方法を定義する。

本書の目的は、カードを追加するたびにゲームエンジン本体を大きく変更せず、カード効果を安全かつ拡張可能な形で実装できるようにすることである。

---

## 2. カード効果システムの責務

カード効果システムは、次の処理を担当する。

- カード効果の発動条件検証
- 効果対象の検証
- 効果解決前の実行可能性検証
- カード効果の解決
- 継続効果の登録
- 継続効果の終了
- 効果適用順序の管理
- 攻撃力修正
- みなもと変更
- スタミナ変更
- カードドロー
- 攻撃グループ除去
- サポートカード除去
- 効果に対応するゲームイベントの生成

カード効果システムは、次の処理を直接担当しない。

- フェーズ全体の進行
- タイマー管理
- WebSocket通信
- 状態の永続化
- UIアニメーション
- クライアントへの情報公開制御
- デッキシャッフル
- 通常の攻撃カード配置
- 通常の手札補充
- 通常の勝敗判定

これらは、ゲームエンジンまたはバックエンド層が担当する。

---

## 3. 基本設計方針

カード効果は、次の3要素に分離して管理する。

1. カードに記載される効果定義
2. 効果を実行するハンドラー
3. 対戦中に存在する継続効果

```text
カード定義
↓
効果ハンドラーを特定
↓
発動条件と対象を検証
↓
効果を解決
↓
必要な場合は継続効果を登録
```

カード名やカードIDごとの処理を、ゲームエンジン本体の巨大な`switch`文へ直接記述してはならない。

---

## 4. 効果を持つカード

### 4.1 みなもとカード

みなもとカードの効果は固定とする。

```text
カードを引く
↓
対応する属性のみなもと総量を1増加
↓
みなもとカードを捨て札へ移動
```

みなもとカードについては、カード固有の効果ハンドラーを作成しない。

### 4.2 攻撃カード

攻撃カードは、必要に応じて次の効果を持つことができる。

- 場に出たときに一度だけ発動する効果
- 攻撃カードが場に存在する間だけ有効な継続効果

攻撃カードを新規グループとして配置した場合と、既存グループへ連鎖した場合の両方を「場に出た」として扱う。

### 4.3 サポートカード

サポートカードは、次の効果形式を持つことができる。

- 使用時に一度だけ発動する効果
- サポートゾーンに存在する間だけ有効な継続効果

1枚のサポートカードが、使用時効果と継続効果の両方を持つことも許可する。

---

## 5. 効果の発動形式

初期実装では、次の2種類だけを使用する。

```ts
export type EffectActivationType = "onPlay" | "continuous";
```

### 5.1 `onPlay`

カードが場に出たとき、またはサポートカードが使用されたときに、一度だけ解決する。

攻撃カードの場合：

```text
手札から新規グループへ配置
または
既存グループへ連鎖
↓
onPlay効果を解決
```

サポートカードの場合：

```text
手札からサポートゾーンへ配置
↓
onPlay効果を解決
```

### 5.2 `continuous`

効果元カードが場に存在している間、継続して適用する。

継続効果は、対象の数値を直接書き換え続けるのではなく、攻撃力などを計算する時点で参照する。

初期実装では、次の形式は使用しない。

- 特定イベント発生時に反応する`triggered`
- プレイヤーが任意に起動する`activated`
- 相手カードに割り込むスタック方式
- 相手の操作を打ち消すカウンター方式

---

## 6. サポートカードの継続期間

```ts
export type SupportDuration = "instant" | "untilRoundEnd" | "permanent";
```

### 6.1 `instant`

効果を即時解決した後、カードを捨て札へ移動する。

```text
手札
↓
サポートゾーンへ一時配置
↓
効果解決
↓
捨て札
```

- 効果解決中だけコスト分のみなもとを必要とする
- 効果解決後はみなもとが解放される
- 原則として`onPlay`効果だけを持つ
- `continuous`効果を持つことはできない

### 6.2 `untilRoundEnd`

スコア計算および通常勝敗判定が終了するまで場に残る。

```text
手札
↓
サポートゾーン
↓
サポートフェーズ終了
↓
スコア計算
↓
スタミナ反映
↓
通常勝敗判定
↓
捨て札
```

- 場に存在する間、コスト分のみなもとを使用する
- `onPlay`効果と`continuous`効果の両方を持てる
- 勝敗判定終了後に効果を終了する
- カードを捨て札へ移動した後、みなもとを解放する

### 6.3 `permanent`

カード効果によって場から離れるまで、サポートゾーンに残る。

- 場に存在する間、コスト分のみなもとを使用する
- `onPlay`効果と`continuous`効果の両方を持てる
- 場から離れた場合、カードを捨て札へ移動する
- 効果元カードが場から離れた時点で継続効果を終了する
- 場から離れた後、みなもとを解放する

---

## 7. カード定義と効果定義

### 7.1 攻撃カード定義

```ts
export type AttackCardDefinition = {
  id: CardDefinitionId;
  name: string;
  cardType: "attack";
  attribute: Attribute;
  cost: number;
  basePower: number;
  chainableCardIds: CardDefinitionId[];
  effects: CardEffectDefinition[];
};
```

効果を持たない攻撃カードは、`effects`を空配列とする。

### 7.2 サポートカード定義

```ts
export type SupportCardDefinition = {
  id: CardDefinitionId;
  name: string;
  cardType: "support";
  attribute: Attribute;
  cost: number;
  duration: SupportDuration;
  effects: CardEffectDefinition[];
};
```

サポートカードは最低1つの効果を持たなければならない。

### 7.3 効果定義の共通型

```ts
export type BaseEffectDefinition = {
  effectId: string;
  activationType: EffectActivationType;
  targetRule: TargetRule;
};
```

効果定義は、効果の種類によって判別可能なUnion型とする。

```ts
export type CardEffectDefinition =
  | ModifyPowerEffectDefinition
  | ChangeStaminaEffectDefinition
  | ReduceManaEffectDefinition
  | DrawCardsEffectDefinition
  | RemoveAttackGroupEffectDefinition
  | RemoveSupportCardEffectDefinition
  | CustomEffectDefinition;
```

---

## 8. 効果定義と実装コードの境界

すべてのカード効果をJSONだけで表現しようとしてはならない。

### 8.1 共通化できる効果

次のような単純な効果は、共通の効果定義として扱う。

- 攻撃力を増減する
- 攻撃力を上書きする
- 攻撃力を乗算する
- スタミナを増減する
- みなもとを減らす
- カードを引く
- 攻撃グループを捨て札にする
- サポートカードを捨て札にする

### 8.2 固有実装が必要な効果

複数の条件や特殊な処理を持つカードは、固有ハンドラーを実装する。

例：

```text
相手の最も攻撃力が高いグループを選び、
そのグループの攻撃力が10以上なら捨て札にし、
10未満なら攻撃力を半分にする
```

このような効果を、汎用JSONスキーマだけで無理に表現しない。

---

## 9. カスタム効果定義

```ts
export type CustomEffectDefinition = BaseEffectDefinition & {
  type: "custom";
  handlerId: string;
  config: Record<string, unknown>;
};
```

`handlerId`に対応する効果ハンドラーを、効果レジストリから取得する。

```ts
export type EffectRegistry = Record<string, CardEffectHandler>;
```

---

## 10. 効果対象

```ts
export type EffectTarget =
  | CardEffectTarget
  | AttackGroupEffectTarget
  | SupportCardEffectTarget
  | PlayerEffectTarget
  | ManaEffectTarget;
```

### 10.1 攻撃カード対象

```ts
export type CardEffectTarget = {
  type: "attackCard";
  cardInstanceId: CardInstanceId;
};
```

### 10.2 攻撃グループ対象

```ts
export type AttackGroupEffectTarget = {
  type: "attackGroup";
  groupId: AttackGroupId;
};
```

### 10.3 サポートカード対象

```ts
export type SupportCardEffectTarget = {
  type: "supportCard";
  cardInstanceId: CardInstanceId;
};
```

### 10.4 プレイヤー対象

```ts
export type PlayerEffectTarget = {
  type: "player";
  playerId: PlayerId;
};
```

### 10.5 みなもと対象

```ts
export type ManaEffectTarget = {
  type: "mana";
  playerId: PlayerId;
  attribute: Attribute;
};
```

対戦中のカードを指定するときは、カード定義IDではなくカードインスタンスIDを使用する。

---

## 11. 対象ルール

```ts
export type TargetSide = "self" | "opponent" | "either";
```

```ts
export type TargetZone =
  | "attackCard"
  | "attackGroup"
  | "supportCard"
  | "player"
  | "mana";
```

```ts
export type TargetRule = {
  required: boolean;
  minTargets: number;
  maxTargets: number;
  side: TargetSide;
  zones: TargetZone[];
  allowSourceCard: boolean;
};
```

### 11.1 対象を必要としない効果

例：

```text
カードを2枚引く
自分のスタミナを3増やす
```

```ts
const targetRule: TargetRule = {
  required: false,
  minTargets: 0,
  maxTargets: 0,
  side: "self",
  zones: [],
  allowSourceCard: false,
};
```

### 11.2 対象を1つ選ぶ効果

例：

```text
相手の攻撃グループを1つ捨て札にする
```

```ts
const targetRule: TargetRule = {
  required: true,
  minTargets: 1,
  maxTargets: 1,
  side: "opponent",
  zones: ["attackGroup"],
  allowSourceCard: false,
};
```

---

## 12. サポートカード使用コマンド

複数対象に対応するため、サポートカード使用コマンドは対象を配列として保持する。

```ts
export type PlaySupportCardCommand = BaseGameCommand & {
  type: "PLAY_SUPPORT_CARD";
  cardInstanceId: CardInstanceId;
  targets: EffectTarget[];
  parameters?: Record<string, unknown>;
};
```

対象を必要としないカードでは、`targets`を空配列とする。

フロントエンドが送信した対象情報を信用せず、バックエンド側で再検証する。

---

## 13. 効果実行コンテキスト

```ts
export type EffectContext = {
  state: GameState;
  sourceCardInstanceId: CardInstanceId;
  sourceCardDefinitionId: CardDefinitionId;
  ownerId: PlayerId;
  targets: EffectTarget[];
  parameters: Record<string, unknown>;
  currentRound: number;
  appliedSequence: number;
};
```

効果ハンドラーは、ネットワーク、データベース、現在時刻、乱数へ直接アクセスしてはならない。

必要な値は、ゲームエンジンから明示的に渡す。

---

## 14. 効果ハンドラー

```ts
export interface CardEffectHandler {
  validate(
    context: EffectContext,
    definition: CardEffectDefinition,
  ): EffectValidationResult;

  resolve(
    context: EffectContext,
    definition: CardEffectDefinition,
  ): EffectResolution;
}
```

### 14.1 検証結果

```ts
export type EffectValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      errors: EffectValidationError[];
    };
```

### 14.2 解決結果

```ts
export type EffectResolution = {
  state: GameState;
  events: GameEvent[];
  activeEffectsAdded: ActiveEffect[];
  activeEffectIdsRemoved: EffectInstanceId[];
};
```

---

## 15. 効果検証の原則

効果検証処理は、ゲーム状態を変更してはならない。

検証では、次を確認する。

1. 効果元カードが正しい領域に存在する
2. 効果を使用できるフェーズである
3. プレイヤーが操作権を持つ
4. サポート終了宣言をしていない
5. 必要なみなもとが存在する
6. 対象数が正しい
7. 対象種別が正しい
8. 対象の所有者条件を満たす
9. 対象が現在も存在する
10. カード固有の発動条件を満たす
11. 解決後もゲーム状態の不変条件を維持できる

---

## 16. 効果解決の原子性

1枚のカードが複数の効果を持つ場合でも、カード使用コマンド全体を1つの原子的処理として扱う。

```text
すべて成功
または
すべて失敗
```

効果の途中まで状態を変更した後でエラーが発生した場合は、操作全体を取り消す。

次の状態を部分的に残してはならない。

- スタミナ変更
- みなもと変更
- カード移動
- グループ除去
- 継続効果登録
- 捨て札追加

---

## 17. 効果解決前の計画作成

複数段階の効果では、可能な限り状態変更前に解決計画を作成する。

```ts
export type EffectResolutionPlan = {
  cardMoves: PlannedCardMove[];
  staminaChanges: PlannedStaminaChange[];
  manaChanges: PlannedManaChange[];
  activeEffectsToAdd: ActiveEffect[];
  activeEffectIdsToRemove: EffectInstanceId[];
};
```

処理順：

```text
現在状態から解決計画を作成
↓
計画全体を検証
↓
計画を新しい状態へ適用
↓
不変条件を検証
↓
状態を確定
```

---

## 18. 複数効果の解決順

カードに複数の効果が定義されている場合は、カード定義内の配列順で処理する。

```ts
effects: [effectA, effectB, effectC];
```

処理順：

```text
effectA
↓
effectB
↓
effectC
```

ただし、状態の確定はカード使用コマンド全体が成功した後に一度だけ行う。

後続効果は、先行効果を適用した仮状態を参照する。

---

## 19. サポートカード使用時の共通処理

サポートカードを使用するときは、次の順番で処理する。

1. ゲームとフェーズを検証する
2. 使用プレイヤーを検証する
3. サポート終了状態を検証する
4. 対象カードが手札にあることを確認する
5. カードのコストを確認する
6. 対象情報を検証する
7. カード固有条件を検証する
8. カードを手札からサポートゾーンへ移動した仮状態を作る
9. すべての`onPlay`効果を定義順に解決する
10. `continuous`効果を登録する
11. 継続期間に応じてカード位置を確定する
12. 状態不変条件を検証する
13. 新しい状態とイベントを確定する

---

## 20. 攻撃カード効果の発動

攻撃カードの`onPlay`効果は、カード配置が正常に完了した後に解決する。

### 20.1 新規グループへ配置

```text
配置条件検証
↓
新規グループ作成
↓
みなもと再計算
↓
onPlay効果解決
↓
continuous効果登録
```

### 20.2 既存グループへ連鎖

```text
連鎖条件検証
↓
グループ末尾へ追加
↓
グループコスト再計算
↓
onPlay効果解決
↓
continuous効果登録
```

攻撃カードの効果解決に失敗した場合は、配置または連鎖操作全体を取り消す。

---

## 21. 継続効果

```ts
export type ActiveEffect = {
  effectInstanceId: EffectInstanceId;
  effectDefinitionId: string;

  sourceCardInstanceId: CardInstanceId;
  ownerId: PlayerId;

  target: EffectTarget;
  scope: EffectScope;
  operation: EffectOperation;
  value: number;

  duration: ActiveEffectDuration;
  appliedSequence: number;
  appliedRound: number;
};
```

```ts
export type ActiveEffectDuration = "untilRoundEnd" | "whileSourceOnField";
```

### 21.1 `untilRoundEnd`

スコア計算と通常勝敗判定が終了するまで有効とする。

### 21.2 `whileSourceOnField`

効果元カードが場に存在する間だけ有効とする。

攻撃カードおよび`permanent`サポートカードの継続効果に使用する。

---

## 22. 効果適用順序

すべての継続効果に、単調増加する`appliedSequence`を付与する。

```text
先に適用された効果：sequence 10
後に適用された効果：sequence 11
```

複数の上書き効果が存在する場合は、最も大きい`appliedSequence`を持つ効果を採用する。

ゲーム状態には、次の値を保持する。

```ts
nextEffectSequence: number;
```

効果登録後に1増加させる。

---

## 23. 効果元カードが場から離れた場合

効果元カードが場から離れた場合は、そのカードを効果元とする`continuous`効果をすべて削除する。

```text
攻撃グループが除去される
↓
グループ内カードを捨て札へ移動
↓
各カードを効果元とする継続効果を削除
```

```text
permanentサポートが除去される
↓
サポートカードを捨て札へ移動
↓
そのカードを効果元とする継続効果を削除
```

`onPlay`によってすでに確定した即時変更は、効果元カードが場を離れても取り消さない。

例：

- すでに減らされたみなもと総量
- すでに変更されたスタミナ
- すでに引いたカード
- すでに捨て札になったグループ

---

## 24. 効果対象が場から離れた場合

特定カードまたは特定グループを対象とする継続効果は、対象が存在しなくなった時点で削除する。

効果元カードが残っていても、自動的に別の対象へ付け替えない。

```text
対象グループが除去される
↓
対象グループに紐づく継続効果を削除
```

初期実装では、継続効果の再対象選択は行わない。

---

## 25. 作成済みグループの再検証

カード効果によってグループ構成が変化しても、過去の連鎖条件は再検証しない。

連鎖条件は、新しいカードを追加する瞬間だけ確認する。

初期実装では、攻撃カードを個別に除去する効果を作成せず、攻撃グループ全体を除去対象とする。

---

# 共通効果定義

## 26. 攻撃力変更効果

```ts
export type PowerScope = "cardPower" | "groupPower" | "totalPower";
```

```ts
export type PowerOperation = "overwrite" | "add" | "multiply";
```

```ts
export type ModifyPowerEffectDefinition = BaseEffectDefinition & {
  type: "modifyPower";
  scope: PowerScope;
  operation: PowerOperation;
  value: number;
};
```

### 26.1 カード攻撃力

対象となる攻撃カードの最終攻撃力計算へ適用する。

### 26.2 グループ攻撃力

対象グループ内のカード攻撃力を合計した後に適用する。

### 26.3 総パワー

対象プレイヤーの全グループ攻撃力を合計した後に適用する。

---

## 27. 攻撃力の計算順

カード単体：

```text
基礎攻撃力
↓
最新の上書き
↓
加算・減算
↓
乗算
↓
小数点以下切り捨て
↓
最低値1
```

グループ：

```text
カード単体の最終攻撃力を合計
↓
最新のグループ上書き
↓
グループ加算・減算
↓
グループ乗算
↓
小数点以下切り捨て
↓
最低値0
```

プレイヤー総パワー：

```text
各グループの最終攻撃力を合計
↓
最新の総パワー上書き
↓
総パワー加算・減算
↓
総パワー乗算
↓
小数点以下切り捨て
↓
最低値0
```

### 27.1 複数の加算効果

すべて合計する。

```text
+2
+3
-1
合計：+4
```

### 27.2 複数の乗算効果

すべて乗算する。

```text
×2
×0.5
最終倍率：×1
```

### 27.3 複数の上書き効果

最後に適用された効果だけを使用する。

---

## 28. スタミナ変更効果

```ts
export type ChangeStaminaEffectDefinition = BaseEffectDefinition & {
  type: "changeStamina";
  amount: number;
};
```

- 正数はスタミナ回復
- 負数はスタミナ減少
- スタミナは0未満になってよい
- カード効果解決直後には勝敗判定を行わない
- 通常勝敗判定はスコア計算終了後に一度だけ実行する

スタミナ回復の上限は、カード定義または将来の基本ルールで明示されない限り設けない。

---

## 29. みなもと減少効果

```ts
export type ReduceManaEffectDefinition = BaseEffectDefinition & {
  type: "reduceMana";
  amount: number;
};
```

対象は、プレイヤーと属性を含む`ManaEffectTarget`とする。

```ts
actualReduction = Math.max(
  0,
  Math.min(requestedReduction, totalMana - reservedMana, totalMana - 1),
);
```

### 29.1 ルール

- 対象属性のみなもと総量を永久に減らす
- みなもと総量を0にしない
- 使用中みなもと未満にはしない
- 指定量をすべて減らせない場合は、減らせる分だけ減らす
- 実際の減少量が0でも、カード固有条件で禁止されていなければ効果は解決する
- 既存カードを停止させる状態は作らない

みなもと減少は継続効果ではなく、ゲーム状態に対する即時かつ永続的な変更として扱う。

---

## 30. カードドロー効果

```ts
export type DrawCardsEffectDefinition = BaseEffectDefinition & {
  type: "drawCards";
  count: number;
};
```

実際に引く枚数は、次の最小値とする。

```ts
actualDrawCount = Math.min(
  requestedCount,
  handLimit - currentHandCount,
  deckCount,
);
```

### 30.1 みなもとカードを引いた場合

引いたみなもとカードは、即座に次の処理を行う。

1. 対応属性のみなもと総量を1増加
2. 捨て札へ移動
3. 追加ドローは行わない

### 30.2 山札が0になった場合

カード効果によるドローで山札が0になっても、即座には山札切れとしない。

山札切れは、手札補充フェーズ開始時に判定する。

---

## 31. 攻撃グループ除去効果

```ts
export type RemoveAttackGroupEffectDefinition = BaseEffectDefinition & {
  type: "removeAttackGroup";
};
```

対象は攻撃グループ1つとする。

処理順：

1. 対象グループの存在を確認する
2. グループ内カードを上から順番に捨て札へ移動する
3. 対象カードを効果元とする継続効果を削除する
4. 対象グループを対象とする継続効果を削除する
5. グループを削除する
6. みなもとの予約量を再計算する
7. 攻撃グループ枠を1つ解放する

除去後にみなもとの使用量が減少した場合、その差分は即座に使用可能になる。

---

## 32. サポートカード除去効果

```ts
export type RemoveSupportCardEffectDefinition = BaseEffectDefinition & {
  type: "removeSupportCard";
};
```

対象は、サポートゾーンに存在するカード1枚とする。

処理順：

1. 対象カードの存在を確認する
2. 対象カードをサポートゾーンから削除する
3. 対象カードを捨て札へ移動する
4. 対象カードを効果元とする継続効果を削除する
5. 対象カードを対象とする継続効果を削除する
6. みなもとの予約量を再計算する

---

## 33. 複合効果

1枚のカードに複数の共通効果を定義できる。

例：

```text
相手の攻撃グループを1つ捨て札にする。
その後、自分はカードを1枚引く。
```

```ts
effects: [
  {
    effectId: "remove-group",
    type: "removeAttackGroup",
    activationType: "onPlay",
    targetRule: {
      required: true,
      minTargets: 1,
      maxTargets: 1,
      side: "opponent",
      zones: ["attackGroup"],
      allowSourceCard: false,
    },
  },
  {
    effectId: "draw-one",
    type: "drawCards",
    activationType: "onPlay",
    count: 1,
    targetRule: {
      required: false,
      minTargets: 0,
      maxTargets: 0,
      side: "self",
      zones: [],
      allowSourceCard: false,
    },
  },
];
```

対象配列のどの対象をどの効果が使用するかは、効果定義またはカスタムハンドラーで明示する。

---

## 34. 一部だけ実行できる効果

カード文章に「最大」「可能な限り」「減らせるだけ」などの表現がある場合だけ、部分実行を許可する。

例：

```text
相手のみなもとを3減らす
```

基本ルールによって減らせる分だけ減らすため、実際には1だけ減少する場合がある。

一方、次のような効果は対象が存在しなければ使用できない。

```text
相手の攻撃グループを1つ捨て札にする
```

対象が存在しない状態で、カードを使用して捨て札にする処理は行わない。

---

## 35. 効果値の整数制限

次の値は整数で定義する。

- 攻撃力上書き値
- 攻撃力加算値
- スタミナ変更量
- みなもと減少量
- ドロー枚数

乗算値については、小数を許可できる。

例：

```text
×2
×0.5
×1.5
```

乗算後の攻撃力は、最終計算時に小数点以下を切り捨てる。

---

## 36. 継続効果の再計算

継続効果によって変更された攻撃力を、カードインスタンスへ直接保存しない。

```ts
// 保存しない
card.currentPower = 8;
```

攻撃力が必要になるたびに、基礎攻撃力と現在有効な効果から再計算する。

```text
カード定義の基礎攻撃力
+
現在有効な効果
=
現在の最終攻撃力
```

これにより、効果終了時に逆計算して元へ戻す必要がなくなる。

---

## 37. 効果の重複

### 37.1 同じ効果元からの重複

同じカード効果を複数回登録できるかは、カード効果ごとに定義する。

初期実装では、1枚のカードから同じ継続効果を重複登録しない。

### 37.2 異なるカードからの重複

異なるカードから発生した効果は、原則として重複を許可する。

例：

```text
カードA：対象カードの攻撃力+2
カードB：対象カードの攻撃力+3
```

結果：

```text
合計+5
```

### 37.3 上書き効果

複数の上書き効果がある場合は、後から有効になった効果を採用する。

---

## 38. 効果の終了順

ラウンド終了時は、次の順番で処理する。

1. サポートフェーズを終了する
2. 総パワーを計算する
3. スタミナへ反映する
4. 通常勝敗判定を行う
5. `untilRoundEnd`効果を削除する
6. 対応するサポートカードを捨て札へ移動する
7. みなもとを再計算する
8. 最大ラウンド判定または次の処理へ進む

`untilRoundEnd`効果を、スコア計算より前に削除してはならない。

---

## 39. 効果解決中の勝敗判定

カード効果によってスタミナが0以下になっても、効果解決中にはゲームを終了しない。

同じサポートフェーズ中に、別のカードによってスタミナが回復することを許可する。

勝敗判定は、サポートフェーズ終了後のスコア計算およびスタミナ反映が完了した後に一度だけ行う。

---

## 40. 効果解決中のみなもと検証

サポートカードを使用するときは、そのサポートカードを場に置いた状態を仮定してみなもとを検証する。

### 40.1 `instant`

効果解決中のみコストを確保する。

```text
使用前available：3
カードコスト：3
↓
使用可能
↓
効果解決
↓
カードを捨て札へ移動
↓
available：3へ戻る
```

### 40.2 `untilRoundEnd`または`permanent`

サポートゾーンに残るため、カードが場を離れるまでコストを予約する。

効果解決後の状態で、使用可能みなもとが0未満になる場合は使用できない。

---

## 41. みなもと変更を含むカードの自己矛盾

自分のみなもとを減らす効果など、効果解決後に効果元カードのコストを維持できなくなるカードは、解決後の状態不変条件を満たせないため使用を拒否する。

ただし、`instant`カードは効果解決後に場から離れるため、カード自身のコストは最終予約量へ含めない。

---

## 42. 対象の存在確認

対象は、効果解決直前の最新状態で再確認する。

サポートカードはサーバー受信順に処理されるため、先行コマンドによって対象が消える場合がある。

```text
プレイヤーA：
グループXを除去するカード

プレイヤーB：
グループXを強化するカード
```

Aのコマンドが先に解決された場合、Bの対象は存在しない。

Bのコマンドは拒否し、次の状態を維持する。

- サポートカードは手札に残る
- みなもとは使用しない
- 効果は発生しない

---

## 43. 効果エラー

```ts
export type EffectValidationErrorCode =
  | "SOURCE_CARD_NOT_FOUND"
  | "SOURCE_CARD_NOT_ON_EXPECTED_ZONE"
  | "INVALID_ACTIVATION_TYPE"
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
  | "EFFECT_RESOLUTION_FAILED";
```

```ts
export type EffectValidationError = {
  code: EffectValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
};
```

エラーメッセージの文字列を、ゲームロジックの条件判定に使用してはならない。

---

## 44. カード効果イベント

ゲームエンジン内部では、カード効果に対応するイベントを生成する。

```ts
export type CardEffectEvent =
  | {
      type: "CARD_EFFECT_ACTIVATED";
      sourceCardInstanceId: CardInstanceId;
      effectId: string;
      ownerId: PlayerId;
    }
  | {
      type: "CARD_EFFECT_RESOLVED";
      sourceCardInstanceId: CardInstanceId;
      effectId: string;
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
      type: "ATTACK_GROUP_REMOVED";
      playerId: PlayerId;
      groupId: AttackGroupId;
      cardInstanceIds: CardInstanceId[];
    }
  | {
      type: "SUPPORT_CARD_REMOVED";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "CARDS_DRAWN_BY_EFFECT";
      playerId: PlayerId;
      count: number;
    }
  | {
      type: "STAMINA_CHANGED_BY_EFFECT";
      playerId: PlayerId;
      before: number;
      after: number;
    };
```

```ts
export type ActiveEffectRemovalReason =
  | "durationEnded"
  | "sourceLeftField"
  | "targetLeftField"
  | "gameFinished";
```

---

## 45. 公開イベントへの変換

内部イベントを、そのまますべてのプレイヤーへ送信してはならない。

カードドローなどの非公開情報を含むイベントは、閲覧者ごとに変換する。

自分向け：

```ts
{
  type: "CARDS_DRAWN_BY_EFFECT",
  count: 2,
  cardInstanceIds: ["card-1", "card-2"],
}
```

相手向け：

```ts
{
  type: "CARDS_DRAWN_BY_EFFECT",
  count: 2,
}
```

相手の手札内容や山札順序をイベント経由で漏えいさせてはならない。

---

## 46. JSON定義例：攻撃力上昇

```json
{
  "id": "support-fire-001",
  "name": "炎の強化",
  "cardType": "support",
  "attribute": "fire",
  "cost": 2,
  "duration": "untilRoundEnd",
  "effects": [
    {
      "effectId": "increase-group-power",
      "type": "modifyPower",
      "activationType": "continuous",
      "scope": "groupPower",
      "operation": "add",
      "value": 3,
      "targetRule": {
        "required": true,
        "minTargets": 1,
        "maxTargets": 1,
        "side": "self",
        "zones": ["attackGroup"],
        "allowSourceCard": false
      }
    }
  ]
}
```

---

## 47. JSON定義例：みなもと減少

```json
{
  "id": "support-water-002",
  "name": "源流封鎖",
  "cardType": "support",
  "attribute": "water",
  "cost": 3,
  "duration": "instant",
  "effects": [
    {
      "effectId": "reduce-opponent-mana",
      "type": "reduceMana",
      "activationType": "onPlay",
      "amount": 2,
      "targetRule": {
        "required": true,
        "minTargets": 1,
        "maxTargets": 1,
        "side": "opponent",
        "zones": ["mana"],
        "allowSourceCard": false
      }
    }
  ]
}
```

---

## 48. JSON定義例：攻撃グループ除去

```json
{
  "id": "support-wind-003",
  "name": "陣形崩壊",
  "cardType": "support",
  "attribute": "wind",
  "cost": 4,
  "duration": "instant",
  "effects": [
    {
      "effectId": "remove-opponent-group",
      "type": "removeAttackGroup",
      "activationType": "onPlay",
      "targetRule": {
        "required": true,
        "minTargets": 1,
        "maxTargets": 1,
        "side": "opponent",
        "zones": ["attackGroup"],
        "allowSourceCard": false
      }
    }
  ]
}
```

---

## 49. JSON定義例：複合効果

```json
{
  "id": "support-fire-004",
  "name": "破壊と補給",
  "cardType": "support",
  "attribute": "fire",
  "cost": 5,
  "duration": "instant",
  "effects": [
    {
      "effectId": "remove-group",
      "type": "removeAttackGroup",
      "activationType": "onPlay",
      "targetRule": {
        "required": true,
        "minTargets": 1,
        "maxTargets": 1,
        "side": "opponent",
        "zones": ["attackGroup"],
        "allowSourceCard": false
      }
    },
    {
      "effectId": "draw-one",
      "type": "drawCards",
      "activationType": "onPlay",
      "count": 1,
      "targetRule": {
        "required": false,
        "minTargets": 0,
        "maxTargets": 0,
        "side": "self",
        "zones": [],
        "allowSourceCard": false
      }
    }
  ]
}
```

---

## 50. カード効果レジストリ

```ts
export const effectRegistry: EffectRegistry = {
  modifyPower: modifyPowerEffectHandler,
  changeStamina: changeStaminaEffectHandler,
  reduceMana: reduceManaEffectHandler,
  drawCards: drawCardsEffectHandler,
  removeAttackGroup: removeAttackGroupEffectHandler,
  removeSupportCard: removeSupportCardEffectHandler,
};
```

カスタム効果は、個別の`handlerId`で登録する。

```ts
export const customEffectRegistry: EffectRegistry = {
  conditionalGroupDestroy: conditionalGroupDestroyEffectHandler,

  swapPowerValues: swapPowerValuesEffectHandler,
};
```

---

## 51. 推奨ディレクトリ構成

```text
packages/game-engine/src/
├─ cards/
│  ├─ definitions/
│  ├─ card-definition.ts
│  └─ card-instance.ts
├─ effects/
│  ├─ effect-definition.ts
│  ├─ effect-context.ts
│  ├─ effect-handler.ts
│  ├─ effect-registry.ts
│  ├─ active-effect.ts
│  ├─ common/
│  │  ├─ modify-power.ts
│  │  ├─ change-stamina.ts
│  │  ├─ reduce-mana.ts
│  │  ├─ draw-cards.ts
│  │  ├─ remove-attack-group.ts
│  │  └─ remove-support-card.ts
│  └─ custom/
├─ calculation/
│  ├─ calculate-card-power.ts
│  ├─ calculate-group-power.ts
│  └─ calculate-total-power.ts
├─ validation/
│  ├─ validate-effect-targets.ts
│  ├─ validate-effect-condition.ts
│  └─ validate-active-effects.ts
└─ events/
   └─ card-effect-events.ts
```

---

## 52. カード追加手順

新しいカードを追加するときは、次の順番で作業する。

1. カードの属性、コスト、カード種別を決める
2. 効果文章を自然言語で確定する
3. 発動形式を決める
4. サポートカードの場合は継続期間を決める
5. 対象種別と対象数を決める
6. 使用可能条件を決める
7. 共通効果で実装できるか判断する
8. 共通効果で表現できない場合はカスタムハンドラーを作る
9. 効果定義をJSONへ追加する
10. 正常系テストを作る
11. 対象不正テストを作る
12. みなもと不足テストを作る
13. 効果競合テストを作る
14. 効果終了テストを作る

---

## 53. カード効果定義テンプレート

新しいカード効果は、最低限次の項目を定義する。

```markdown
### カード名

- カード種別：
- 属性：
- コスト：
- 継続期間：
- 発動形式：
- 効果文章：
- 対象：
- 対象数：
- 対象所有者：
- 使用可能条件：
- 解決順：
- 効果終了条件：
- 対象が存在しない場合：
- 指定量を完全に適用できない場合：
- 生成イベント：
- 使用ハンドラー：
```

---

## 54. カード効果テスト

各カード効果について、最低限次のテストを作成する。

### 54.1 正常系

- 正しい対象へ使用できる
- 指定どおり状態が変更される
- 正しいイベントが生成される
- カードが正しい領域へ移動する
- みなもとが正しく予約または解放される

### 54.2 対象検証

- 対象が存在しない
- 対象種別が異なる
- 自分対象と相手対象を間違える
- 対象数が不足する
- 対象数が超過する

### 54.3 みなもと

- みなもとが足りない
- コストちょうどで使用する
- `instant`解決後にみなもとが戻る
- `untilRoundEnd`終了時にみなもとが戻る
- `permanent`除去時にみなもとが戻る

### 54.4 継続効果

- 効果元カードが場にある間だけ有効
- 効果元カード除去時に終了
- 対象除去時に終了
- ラウンド終了時に終了
- 複数効果の重複
- 最新上書き効果の優先

### 54.5 原子性

- 効果途中で失敗した場合に全変更を取り消す
- カードが手札へ残る
- みなもとが変化しない
- 捨て札が変化しない
- 継続効果が登録されない

### 54.6 競合

- 先行コマンドによって対象が消える
- 後続コマンドが拒否される
- 同じ対象へ複数の効果が適用される
- 上書き効果の順番が正しい

---

## 55. 初期実装の対象範囲

初期実装では、次の機能を優先する。

- `onPlay`
- `continuous`
- `instant`
- `untilRoundEnd`
- `permanent`
- 攻撃力の上書き
- 攻撃力の加算・減算
- 攻撃力の乗算
- スタミナ変更
- みなもと減少
- カードドロー
- 攻撃グループ全体除去
- サポートカード除去
- 効果元カードに紐づく継続効果
- サーバー受信順による即時解決

初期実装では、次の機能を対象外とする。

- 効果への割り込み
- 効果の無効化
- カウンターカード
- イベントトリガー
- 任意起動型効果
- 墓地からのカード回収
- 攻撃カード単体除去
- グループ分割
- グループ統合
- カードの通常移動
- 複数属性コスト
- 無属性カード
- ランダム対象
- 山札の検索
- 山札順序の変更
- 相手手札の閲覧
- 継続効果の対象付け替え

---

## 56. 実装上の原則

カード効果実装では、次の原則を守る。

1. 効果検証と効果解決を分離する
2. 効果検証中に状態を変更しない
3. 効果解決を原子的に処理する
4. 対象をカードインスタンスIDで指定する
5. クライアントの対象判定を信用しない
6. サーバー上の最新状態で再検証する
7. 効果元カードと継続効果を関連付ける
8. 効果元カードが場を離れたら継続効果を終了する
9. 攻撃力をカード状態へ直接書き込まない
10. 攻撃力は基礎値と有効効果から再計算する
11. 複数効果は定義順に解決する
12. 上書き効果は最後に有効になったものを採用する
13. 固有処理を無理にJSONだけで表現しない
14. 共通効果とカスタム効果を分離する
15. 内部イベントから非公開情報を除いてクライアントへ送る
16. UIアニメーションの完了を効果解決条件にしない
17. カード効果ごとに正常系・異常系・競合テストを作る
18. 解決後にゲーム状態の不変条件を必ず検証する
