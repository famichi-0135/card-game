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

/**
 * みなもとが各属性3枚までであるため、カード単体の必要みなもとも3以下に固定する。
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

const attackNames: Record<Faction, readonly string[]> = {
  disaster: [
    "猛暑の兆候",
    "長期熱波",
    "都市熱暴走",
    "集中豪雨の兆候",
    "河川氾濫",
    "広域浸水",
    "強風の兆候",
    "大型台風",
    "森林火災",
    "土砂災害",
    "高潮",
  ],
  countermeasure: [
    "早期警戒",
    "避難誘導",
    "防災教育",
    "雨水貯留",
    "河川改修",
    "高台移転",
    "防風林",
    "耐風補強",
    "消防活動",
    "斜面保全",
    "防潮堤",
  ],
};

const manaNames: Record<Faction, readonly string[]> = {
  disaster: ["熱のみなもと", "水のみなもと", "風のみなもと"],
  countermeasure: ["備蓄のみなもと", "治水のみなもと", "避難のみなもと"],
};

const supportNames: Record<Faction, readonly string[]> = {
  disaster: [
    "ヒートアイランド増幅",
    "支援網の寸断",
    "水源汚染",
    "避難疲労",
    "避難路遮断",
    "情報混乱",
  ],
  countermeasure: [
    "地域連携",
    "緊急復旧",
    "資源再配分",
    "応急救護",
    "被害区域封鎖",
    "防災情報収集",
  ],
};

const starterAttackNumbers = [
  1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 11,
] as const;

export const INITIAL_CARD_CATALOG_INPUT: CardCatalogInput = {
  version: "initial-catalog-v4-starter-balance",
  definitions: [
    ...createFactionDefinitions("disaster"),
    ...createFactionDefinitions("countermeasure"),
  ].map(withPresentation),
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
    ...attributes.map((attribute, index) => ({
      id: `${faction}-mana-${index + 1}`,
      name: manaNames[faction][index] ?? `みなもと${index + 1}`,
      faction,
      attribute,
      cardType: "mana" as const,
      manaAmount: 1 as const,
    })),
    ...attackTemplates.map((template, index) => ({
      id: `${faction}-attack-${index + 1}`,
      name: attackNames[faction][index] ?? `攻撃カード${index + 1}`,
      faction,
      attribute: template.attribute,
      cardType: "attack" as const,
      cost: template.cost,
      basePower: template.basePower,
      chainableCardIds: template.chainableAttackNumbers.map(
        (number) => `${faction}-attack-${number}`,
      ),
      effects: [],
    })),
    ...createSupportDefinitions(faction),
  ];
}

function createSupportDefinitions(faction: Faction): CardDefinition[] {
  const names = supportNames[faction];
  const isDisaster = faction === "disaster";
  return [
    {
      id: `${faction}-support-group-boost`,
      name: names[0] ?? "攻撃力強化",
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
      name: names[1] ?? "サポート除去",
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
      name: names[2] ?? "みなもと減少",
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
      name: names[3] ?? "スタミナ操作",
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
      name: names[4] ?? "攻撃グループ除去",
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
      name: names[5] ?? "カードドロー",
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
      Array.from({ length: 3 }, () => `${faction}-mana-${index + 1}`),
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

function withPresentation(definition: CardDefinition): CardDefinition {
  return {
    ...definition,
    presentation: {
      rulesText: createRulesText(definition),
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
