import type {
  Attribute,
  CardCatalogInput,
  CardDefinition,
  CardEffectDefinition,
  Faction,
  TargetRule,
} from "@disastar/game-engine/contracts";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;

type AttackTemplate = {
  attribute: Attribute;
  cost: number;
  basePower: number;
  chainableAttackNumbers: readonly number[];
};

type CardContent = {
  name: string;
  description: string;
};

/**
 * みなもとが各属性4枚までであるため、カード単体の必要みなもとも3以下に固定する。
 * 1 -> 2 -> 3 の連鎖は、少ないみなもとでも段階的に盤面を育てられる基本線である。
 */
const attackTemplates: readonly AttackTemplate[] = [
  {
    attribute: "attributeA",
    cost: 1,
    basePower: 1,
    chainableAttackNumbers: [2],
  },
  {
    attribute: "attributeA",
    cost: 2,
    basePower: 2,
    chainableAttackNumbers: [3],
  },
  {
    attribute: "attributeA",
    cost: 3,
    basePower: 3,
    chainableAttackNumbers: [],
  },
  {
    attribute: "attributeB",
    cost: 1,
    basePower: 1,
    chainableAttackNumbers: [5],
  },
  {
    attribute: "attributeB",
    cost: 2,
    basePower: 2,
    chainableAttackNumbers: [6],
  },
  {
    attribute: "attributeB",
    cost: 3,
    basePower: 3,
    chainableAttackNumbers: [],
  },
  {
    attribute: "attributeC",
    cost: 1,
    basePower: 1,
    chainableAttackNumbers: [8],
  },
  {
    attribute: "attributeC",
    cost: 2,
    basePower: 2,
    chainableAttackNumbers: [11],
  },
  {
    attribute: "attributeA",
    cost: 2,
    basePower: 2,
    chainableAttackNumbers: [3],
  },
  {
    attribute: "attributeB",
    cost: 2,
    basePower: 2,
    chainableAttackNumbers: [6],
  },
  {
    attribute: "attributeC",
    cost: 3,
    basePower: 3,
    chainableAttackNumbers: [],
  },
];

const manaContents: Record<Faction, readonly CardContent[]> = {
  disaster: [
    {
      name: "大地のみなもと",
      description:
        "地震、土砂災害、火山噴火など、大地の変動から生まれる災害の力です。",
    },
    {
      name: "水のみなもと",
      description:
        "大雨、河川の氾濫、津波など、水の動きから生まれる災害の力です。",
    },
    {
      name: "空のみなもと",
      description:
        "台風、強風、猛暑など、空と大気の変化から生まれる災害の力です。",
    },
  ],
  countermeasure: [
    {
      name: "備える力のみなもと",
      description:
        "ハザードマップ、備蓄、訓練など、災害が起きる前に命を守るための力です。",
    },
    {
      name: "守る力のみなもと",
      description:
        "堤防、耐震化、地盤改良など、災害の被害を減らすための力です。",
    },
    {
      name: "つながる力のみなもと",
      description:
        "避難、情報伝達、地域の助け合いなど、命を守る行動を広げるための力です。",
    },
  ],
};

const attackContents: Record<Faction, readonly CardContent[]> = {
  disaster: [
    {
      name: "微小地震",
      description:
        "人間の体では感じられない、ごく小さな地震です。日本列島では毎日無数に発生しており、巨大な地殻変動や次の大地震に向けたエネルギー蓄積のサインとなります。",
    },
    {
      name: "直下型地震",
      description:
        "陸域の活断層がズレることで発生する地震です。震源が浅いため、都市部の真下で起きるとマグニチュードが小さくても局所的に激しい揺れとなり、甚大な被害をもたらします。",
    },
    {
      name: "海溝型巨大地震",
      description:
        "海のプレートが陸のプレートの下に沈み込む境界で、限界に達した地盤が跳ね上がることで起きる超巨大地震です。広い範囲に極めて強い揺れを長時間もたらします。",
    },
    {
      name: "大雨",
      description:
        "短時間に爆発的な大雨が降ると、地中に水分が吸収しきれなくなり、すべての水が一気に河川へ流れ込みます。これにより水位が急激に上昇し、河川の氾濫（外水氾濫）を引き起こす危険性が高まります。",
    },
    {
      name: "河川の氾濫",
      description:
        "集中豪雨、台風などで降った多量の雨が河川に流れ込むと、河川が氾濫し水があふれ出すことがある。河川が氾濫すると高い所へ避難をしなければいけなかったり、低い場所にある建物が壊されたりする。例えば2009年7月には、佐賀県で起きた集中豪雨で川の堤防が壊れたため、1400人以上が避難した。",
    },
    {
      name: "巨大津波（防潮堤超過）",
      description:
        "あらゆる沿岸インフラの想定を遥かに超える高さで押し寄せる大津波です。沿岸の街一帯を完全に水没させ、壊滅させます。",
    },
    {
      name: "温帯低気圧",
      description:
        "暖かい空気と冷たい空気がぶつかることで発生し、日本に四季折々の雨や風をもたらします。南から進んできた強い台風が、北の冷たい空気と混ざり合うことで、この温帯低気圧へと性質を変えることも多くあります。",
    },
    {
      name: "台風",
      description:
        "熱帯の海水面温度が上がると、大量の水蒸気が上昇して積乱雲が発達し、台風が生まれます。近年の地球温暖化は海水の温度を上昇させ、台風をより大型化・強力化させる原因の一つとして懸念されています。",
    },
    {
      name: "液状化現象",
      description:
        "水分を多く含んだ砂質の地盤が、激しい揺れによって泥水のようになってしまう現象です。沿岸部や埋立地で多く発生し、電柱が傾き、水道管などのライフラインが破裂します。",
    },
    {
      name: "河川遡上（かせんそじょう）",
      description:
        "行き場を失った津波が川を逆流し、堤防を乗り越えて内陸深くまで押し寄せます。海から離れた地域に不意打ちの打撃を与えます。",
    },
    {
      name: "猛烈な偏西風",
      description:
        "日本の上空を流れる強い西風が、噴出した火山灰を東側の都市部へと一気に運びます。このターン、次に使用する「火山灰」の攻撃力を+3します。",
    },
  ],
  countermeasure: [
    {
      name: "ハザードマップの確認",
      description:
        "地域の危険箇所や避難場所を事前に把握しておくことで、災害発生時の迅速な判断を可能にします。すべての防災行動の起点となる知識です。",
    },
    {
      name: "家具の固定・転倒防止",
      description:
        "L字金具や突っ張り棒でタンスや本棚を固定します。大地震の際の屋内での押し潰され事故やケガ、避難経路の遮断を防ぎます。",
    },
    {
      name: "建物の耐震改修",
      description:
        "柱や筋交いを補強して建物の強度を高めます。激しい揺れを受けても建造物が全壊・倒壊するリスクを劇的に低減します。",
    },
    {
      name: "土のう・水のうの設置",
      description:
        "土や水を詰めた袋を建物の入口に積み上げ、家屋への浸水を一時的に食い止めます。津波の引き波や局所的な越水に対応します。",
    },
    {
      name: "堤防",
      description:
        "堤防は、川の両岸に土を盛り高くすることで、増水した水が市街地へあふれ出るのを防ぐ最も基本的な治水施設です。",
    },
    {
      name: "防潮堤（津波防波堤）",
      description:
        "海岸沿いに強固なコンクリート壁を建設し、押し寄せる高潮や津波のエネルギーを直接食い止めます。沿岸部の都市を守る防壁です。",
    },
    {
      name: "防災行政無線",
      description:
        "緊急時にスピーカーやスマホへ瞬時に警報を鳴らします。全住民が一斉に初期避難行動を起こすための警戒情報を届けます。",
    },
    {
      name: "避難指示の発令",
      description:
        "危険な地域にいる全員へ直ちに避難するよう自治体が命じます。全員が速やかに退避を開始することで、直後に押し寄せる災害からの致命的な被害を完全に回避します。",
    },
    {
      name: "避難ルートの確認",
      description:
        "危険箇所（崩れやすい斜面や浸水しやすい高架下）を避け、夜間や停電時でも安全に移動できる避難経路を事前に確認・把握しておきます。",
    },
    {
      name: "地盤改良（液状化対策）",
      description:
        "薬液注入や杭打ちによって埋立地などの軟弱地盤を固めます。激しい地震が来ても泥水化（液状化）による建物の沈下を防ぎます。",
    },
    {
      name: "自助・共助・公助",
      description:
        "「自分の身は自分で守る（自助）」「地域で支え合う（共助）」「行政が総力で救う（公助）」が一体となる統合防災体制。あらゆる災害に対する完璧な防衛ラインを構築します。",
    },
  ],
};

const supportContents: Record<Faction, readonly CardContent[]> = {
  disaster: [
    {
      name: "猛烈な偏西風",
      description:
        "日本の上空を流れる強い西風が、噴出した火山灰を東側の都市部へと一気に運びます。このターン、次に使用する「火山灰」の攻撃力を+3します。",
    },
    {
      name: "ライフラインの寸断・途絶",
      description:
        "電気・ガス・水道や通信網が完全に破壊され、救援活動が困難になります。このカードを発動した次のターン、相手が使用するサポートカードのコスト（マナ）はすべて1増えます。",
    },
    {
      name: "建物の倒壊",
      description:
        "激しい揺れで古い家屋やビルが崩壊し、街のインフラや防衛拠点を押し潰します。このカードは使用後も場に残り続け、場にある限り相手のすべてのカードの攻撃力をマイナス1し続けます。",
    },
    {
      name: "地震火災",
      description:
        "倒壊した建物から同時多発的に火の手が上がり、街全体を激しい熱風と炎が包み込みます。このターン、自分が次以降に使用するすべての「地震」カードの攻撃力をプラス2します。",
    },
    {
      name: "土石流",
      description:
        "谷の土砂や巨木が豪雨で一気に崩れ、水と混ざり合って猛スピードで流れる現象です。山間部の集落や扇状地の出口にある街を瞬時に壊滅させます。",
    },
    {
      name: "マグマ溜まりの圧力限界",
      description:
        "地下のマグマが限界まで膨れ上がり、爆発寸前の状態です。山札から「小規模噴火」または「火山性微動」を1枚手札に加えます。",
    },
  ],
  countermeasure: [
    {
      name: "津波・地震避難訓練",
      description:
        "平時からの「揺れたら高台へ」という迅速な意識が命を救います。このターン、次に使用する「津波」または「地震」対策カードの攻撃力を+4します。",
    },
    {
      name: "自主防災組織・安否確認",
      description:
        "地域住民同士で支え合う共助の組織です。このカードが場にある限り、相手の地震による「建物の倒壊」などの永続弱体化効果を相殺・無効化します。",
    },
    {
      name: "非常用備蓄セット",
      description:
        "水・食料・簡易トイレなどの備蓄品です。避難生活での生存率を底上げします。山札からコスト3以下の防御カードを1枚手札に加えます。",
    },
    {
      name: "トリアージ＆応急救護所",
      description:
        "被災直後の混乱期に負傷者の優先順位を判断し救命率を大幅アップさせます。次の相手ターン、相手の攻撃カードから受けるダメージを半減します。",
    },
    {
      name: "緊急安全確保（警戒レベル5）",
      description:
        "すでに氾濫や土砂崩れが発生中、または切迫している状況での最終警告。命を守る最善の行動を即座に促します。このターン、自分が次に使用する防衛攻撃カードの攻撃力を+5します。",
    },
    {
      name: "仮設住宅の建設",
      description:
        "被災者の住まいを確保し長期復興への基盤を作ります。発動時に自分の手札を1枚ドローします。",
    },
  ],
};

const starterAttackNumbers = [1, 2, 3, 9, 4, 5, 6, 10, 7, 7, 8, 11] as const;

export const INITIAL_CARD_CATALOG_INPUT: CardCatalogInput = {
  version: "initial-catalog-v5-learning-content",
  definitions: [
    ...createFactionDefinitions("disaster"),
    ...createFactionDefinitions("countermeasure"),
  ],
};

const disasterStarterDeckDefinitionIds = createStarterDeckIds("disaster");
const countermeasureStarterDeckDefinitionIds =
  createStarterDeckIds("countermeasure");

export function createStarterDeckDefinitionIds(faction: Faction): string[] {
  return faction === "disaster"
    ? createDisasterStarterDeckDefinitionIds()
    : createCountermeasureStarterDeckDefinitionIds();
}

export function createDisasterStarterDeckDefinitionIds(): string[] {
  return [...disasterStarterDeckDefinitionIds];
}

export function createCountermeasureStarterDeckDefinitionIds(): string[] {
  return [...countermeasureStarterDeckDefinitionIds];
}

function createFactionDefinitions(faction: Faction): CardDefinition[] {
  return [
    ...attributes.map((attribute, index) => {
      const content = manaContents[faction][index];
      return withPresentation(
        {
          id: `${faction}-mana-${index + 1}`,
          name: content?.name ?? `みなもと${index + 1}`,
          faction,
          attribute,
          cardType: "mana" as const,
          manaAmount: 1 as const,
        },
        content?.description,
      );
    }),
    ...attackTemplates.map((template, index) => {
      const content = attackContents[faction][index];
      return withPresentation(
        {
          id: `${faction}-attack-${index + 1}`,
          name: content?.name ?? `攻撃カード${index + 1}`,
          faction,
          attribute: template.attribute,
          cardType: "attack" as const,
          cost: template.cost,
          basePower: template.basePower,
          chainableCardIds: template.chainableAttackNumbers.map(
            (number) => `${faction}-attack-${number}`,
          ),
          effects: [],
        },
        content?.description,
      );
    }),
    ...createSupportDefinitions(faction).map((definition, index) =>
      withPresentation(
        definition,
        supportContents[faction][index]?.description,
      ),
    ),
  ];
}

function createSupportDefinitions(faction: Faction): CardDefinition[] {
  const contents = supportContents[faction];
  const isDisaster = faction === "disaster";
  return [
    {
      id: `${faction}-support-group-boost`,
      name: contents[0]?.name ?? "攻撃力強化",
      faction,
      attribute: "attributeA",
      cardType: "support",
      cost: 1,
      duration: "untilRoundEnd",
      effects: [
        {
          effectId: "increase-group-power",
          type: "modifyPower",
          activationType: "continuous",
          scope: "groupPower",
          operation: "add",
          value: 1,
          targetRule: singleTargetRule("self", "attackGroup"),
        },
      ],
    },
    {
      id: `${faction}-support-remove-support`,
      name: contents[1]?.name ?? "サポート除去",
      faction,
      attribute: "attributeB",
      cardType: "support",
      cost: 1,
      duration: "instant",
      effects: [
        {
          effectId: "remove-opponent-support",
          type: "removeSupportCard",
          activationType: "onPlay",
          targetRule: singleTargetRule("opponent", "supportCard"),
        },
      ],
    },
    {
      id: `${faction}-support-reduce-mana`,
      name: contents[2]?.name ?? "みなもと減少",
      faction,
      attribute: "attributeB",
      cardType: "support",
      cost: 2,
      duration: "instant",
      effects: [
        {
          effectId: "reduce-opponent-mana",
          type: "reduceMana",
          activationType: "onPlay",
          amount: 1,
          targetRule: singleTargetRule("opponent", "mana"),
        },
      ],
    },
    {
      id: `${faction}-support-stamina`,
      name: contents[3]?.name ?? "スタミナ操作",
      faction,
      attribute: "attributeC",
      cardType: "support",
      cost: 1,
      duration: "instant",
      effects: [
        {
          effectId: isDisaster
            ? "damage-opponent-stamina"
            : "restore-self-stamina",
          type: "changeStamina",
          activationType: "onPlay",
          amount: isDisaster ? -1 : 1,
          targetRule: singleTargetRule(
            isDisaster ? "opponent" : "self",
            "player",
          ),
        },
      ],
    },
    {
      id: `${faction}-support-remove-group`,
      name: contents[4]?.name ?? "攻撃グループ除去",
      faction,
      attribute: "attributeC",
      cardType: "support",
      cost: 3,
      duration: "instant",
      effects: [
        {
          effectId: "remove-opponent-group",
          type: "removeAttackGroup",
          activationType: "onPlay",
          targetRule: singleTargetRule("opponent", "attackGroup"),
        },
      ],
    },
    {
      // 既存保存済みデッキとの互換のためIDは維持する。
      id: `${faction}-support-destroy-draw`,
      name: contents[5]?.name ?? "カードドロー",
      faction,
      attribute: "attributeA",
      cardType: "support",
      cost: 1,
      duration: "instant",
      effects: [
        {
          effectId: "draw-one",
          type: "drawCards",
          activationType: "onPlay",
          count: 1,
          targetRule: noTargetRule(),
        },
      ],
    },
  ];
}

function singleTargetRule(
  side: "self" | "opponent",
  zone: "attackGroup" | "supportCard" | "player" | "mana",
): TargetRule {
  return {
    required: true,
    minTargets: 1,
    maxTargets: 1,
    side,
    zones: [zone],
    allowSourceCard: false,
  };
}

function noTargetRule(): TargetRule {
  return {
    required: false,
    minTargets: 0,
    maxTargets: 0,
    side: "self",
    zones: [],
    allowSourceCard: false,
  };
}

function createStarterDeckIds(faction: Faction): string[] {
  return [
    ...attributes.flatMap((_, index) =>
      Array.from({ length: 4 }, () => `${faction}-mana-${index + 1}`),
    ),
    ...starterAttackNumbers.map((number) => `${faction}-attack-${number}`),
    `${faction}-support-group-boost`,
    `${faction}-support-remove-support`,
    `${faction}-support-reduce-mana`,
    `${faction}-support-stamina`,
    `${faction}-support-remove-group`,
    `${faction}-support-destroy-draw`,
  ];
}

function withPresentation(
  definition: CardDefinition,
  learningDescription: string | undefined,
): CardDefinition {
  return {
    ...definition,
    presentation: {
      rulesText:
        learningDescription === undefined
          ? createRulesText(definition)
          : `${learningDescription}\n\nゲーム上の効果: ${createRulesText(definition)}`,
      imageAssetId: null,
    },
  };
}

function createRulesText(definition: CardDefinition): string {
  switch (definition.cardType) {
    case "mana":
      return "引いた直後に対応属性のみなもと総量を1増やし、捨て札へ移動します。";
    case "attack":
      return `必要なみなもと ${definition.cost}。基本攻撃力 ${definition.basePower}。`;
    case "support":
      return `${createDurationText(definition.duration)}。${definition.effects
        .map(createEffectRulesText)
        .join(" ")}`;
  }
}

function createEffectRulesText(effect: CardEffectDefinition): string {
  const targetLabel = createTargetLabel(effect.targetRule.side);
  switch (effect.type) {
    case "modifyPower":
      return `${targetLabel}の攻撃グループの攻撃力を${formatSigned(effect.value)}。`;
    case "changeStamina":
      return `${targetLabel}のスタミナを${formatSigned(effect.amount)}。`;
    case "reduceMana":
      return `${targetLabel}のみなもとを${effect.amount}減らします。`;
    case "drawCards":
      return `カードを${effect.count}枚引きます。`;
    case "removeAttackGroup":
      return `${targetLabel}の攻撃グループを除去します。`;
    case "removeSupportCard":
      return `${targetLabel}のサポートカードを除去します。`;
    case "custom":
      return "固有の効果を解決します。";
  }
}

function createTargetLabel(
  side: CardEffectDefinition["targetRule"]["side"],
): string {
  switch (side) {
    case "self":
      return "自分";
    case "opponent":
      return "相手";
    case "either":
      return "選んだプレイヤー";
  }
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function createDurationText(
  duration: "instant" | "untilRoundEnd" | "permanent",
): string {
  switch (duration) {
    case "instant":
      return "使用後すぐに解決されます";
    case "untilRoundEnd":
      return "ラウンド終了まで効果が続きます";
    case "permanent":
      return "場にある間、効果が続きます";
  }
}
