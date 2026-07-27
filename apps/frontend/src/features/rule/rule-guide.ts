export type RuleIllustration = Readonly<{
  alt: string;
  caption: string;
  src?: string;
}>;

export type RuleGuideSection = Readonly<{
  id:
    | "goal"
    | "cards-and-sources"
    | "round-flow"
    | "attack-and-chain"
    | "support"
    | "scoring-and-end";
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  illustration: RuleIllustration;
}>;

export const RULE_GUIDE_SETTINGS = {
  initialHandSize: 5,
  initialStamina: 25,
  maxAttackGroups: 5,
  maxRounds: 30,
  placementLimitSeconds: 90,
  supportLimitSeconds: 60,
} as const;

export const RULE_GUIDE_SECTIONS: readonly RuleGuideSection[] = [
  {
    id: "goal",
    eyebrow: "まず知ること",
    title: "総パワーで相手のスタミナを減らす",
    description:
      "各ラウンドの終わりに総パワーを比べます。低かった側は、その差と同じだけスタミナを失います。",
    points: [
      `初期スタミナは ${RULE_GUIDE_SETTINGS.initialStamina}。0 以下になったら負けです。`,
      "総パワーが同じなら、どちらのスタミナも減りません。",
      "より高い総パワーを出した側が、次のラウンドの先攻です。",
    ],
    illustration: {
      alt: "総パワーの差でスタミナが減る流れを示す図",
      caption: "総パワーとスタミナの関係を示す図を追加予定です。",
    },
  },
  {
    id: "cards-and-sources",
    eyebrow: "カードの役割",
    title: "3種類のカードを使い分ける",
    description:
      "みなもとで使える力を増やし、攻撃カードで総パワーを作り、サポートカードで状況を変えます。",
    points: [
      "みなもとカードは引いた時点で自動的に処理され、対応する属性のみなもとを 1 増やします。",
      "攻撃カードは攻撃グループに置き、残り続ける限り総パワーに加わります。",
      "サポートカードはサポートフェーズで使い、効果や継続期間に応じて場に残ります。",
    ],
    illustration: {
      alt: "みなもと、攻撃、サポートの3種類のカードを示す図",
      caption: "3種類のカードの役割を示す図を追加予定です。",
    },
  },
  {
    id: "round-flow",
    eyebrow: "ラウンドの流れ",
    title: "配置、サポート、自動判定の順に進む",
    description:
      "先攻と後攻が順番に攻撃カードを配置した後、両者がサポートカードを使います。その後の計算と補充は自動です。",
    points: [
      `攻撃カードの配置は、先攻・後攻それぞれ最大 ${RULE_GUIDE_SETTINGS.placementLimitSeconds} 秒です。`,
      `サポートフェーズは両者共通で最大 ${RULE_GUIDE_SETTINGS.supportLimitSeconds} 秒です。`,
      "スコア計算、勝敗判定、場の整理、手札補充を終えると次のラウンドが始まります。",
    ],
    illustration: {
      alt: "1ラウンドの進行順を示す図",
      caption: "配置から次のラウンドまでの流れを示す図を追加予定です。",
    },
  },
  {
    id: "attack-and-chain",
    eyebrow: "攻撃カードを置く",
    title: "空き枠に配置し、条件が合えば連鎖する",
    description:
      "自分の配置フェーズに、手札の攻撃カードを空き枠へドラッグして新しい攻撃グループを作ります。",
    points: [
      `作れる攻撃グループは最大 ${RULE_GUIDE_SETTINGS.maxAttackGroups} 個です。`,
      "同じ属性で、一番上のカードが連鎖先として認めるカードだけを既存グループへ追加できます。",
      "グループのコストは、そのグループ内で最も高いコストです。みなもとが足りない配置はできません。",
    ],
    illustration: {
      alt: "攻撃カードを空き枠へ配置して連鎖する図",
      caption: "攻撃グループへの配置と連鎖を示す図を追加予定です。",
    },
  },
  {
    id: "support",
    eyebrow: "サポートカードを使う",
    title: "サポートフェーズでは両者が好きな順で使える",
    description:
      "サポートフェーズ中は、先攻・後攻に関係なく、使えるサポートカードを自分のタイミングで使用できます。",
    points: [
      "自分が終了を宣言した後は、そのラウンドで新しいサポートカードを使えません。",
      "両者が終了を宣言するか、時間切れになるとスコア計算へ進みます。",
      "場に残るサポートカードは、その間コスト分のみなもとを使用します。",
    ],
    illustration: {
      alt: "サポートフェーズで両者がカードを使う図",
      caption: "サポートカードの使用と終了宣言を示す図を追加予定です。",
    },
  },
  {
    id: "scoring-and-end",
    eyebrow: "ラウンド終了と勝敗",
    title: "スタミナ、山札、ラウンド数で決着する",
    description:
      "スコア計算の後にスタミナが 0 以下ならゲーム終了です。決着しない場合は、攻撃カードを残したまま次のラウンドへ進みます。",
    points: [
      "手札は最大 5 枚まで補充されます。引いたみなもとカードは自動処理され、追加では引きません。",
      "補充開始時に山札が空なら、スタミナが高い側の勝ちです。同じなら引き分けです。",
      `第 ${RULE_GUIDE_SETTINGS.maxRounds} ラウンド終了時は、スタミナ、次に最終総パワーの順で勝敗を決めます。`,
    ],
    illustration: {
      alt: "スコア計算から勝敗判定までを示す図",
      caption: "ラウンド終了時の勝敗判定を示す図を追加予定です。",
    },
  },
];
