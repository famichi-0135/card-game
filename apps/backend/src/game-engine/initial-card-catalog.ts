import type {
  CardCatalogInput,
  CardDefinition,
  Faction,
} from "@disastar/game-engine/contracts";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;
const attackAttributes = [
  "attributeA",
  "attributeA",
  "attributeA",
  "attributeB",
  "attributeB",
  "attributeB",
  "attributeC",
  "attributeC",
  "attributeA",
  "attributeB",
  "attributeC",
] as const;

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

const supportNames: Record<Faction, readonly string[]> = {
  disaster: [
    "ヒートアイランド増幅",
    "ライフライン寸断",
    "水源汚染",
    "災害の長期化",
    "避難路遮断",
    "複合災害",
  ],
  countermeasure: [
    "地域連携",
    "緊急復旧",
    "備蓄活用",
    "応急救護",
    "被害区域封鎖",
    "復旧計画",
  ],
};

export const INITIAL_CARD_CATALOG_INPUT: CardCatalogInput = {
  version: "initial-catalog-v3-presentation",
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
      name: `${faction === "disaster" ? "災害" : "対策"}のみなもと${index + 1}`,
      faction,
      attribute,
      cardType: "mana" as const,
      manaAmount: 1 as const,
    })),
    ...attackNames[faction].map((name, index) => ({
      id: `${faction}-attack-${index + 1}`,
      name,
      faction,
      attribute: attackAttributes[index] ?? "attributeA",
      cardType: "attack" as const,
      cost: (index % 3) + 1,
      basePower: (index % 3) + 2,
      chainableCardIds: createChainableCardIds(faction, index),
      effects: [],
    })),
    ...createSupportDefinitions(faction),
  ];
}

function createChainableCardIds(
  faction: Faction,
  zeroBasedIndex: number,
): string[] {
  const nextIndex = zeroBasedIndex + 2;
  const currentAttribute = attackAttributes[zeroBasedIndex];
  const nextAttribute = attackAttributes[zeroBasedIndex + 1];
  return nextIndex <= 11 && currentAttribute === nextAttribute
    ? [`${faction}-attack-${nextIndex}`]
    : [];
}

function createSupportDefinitions(faction: Faction): CardDefinition[] {
  const names = supportNames[faction];
  return [
    {
      id: `${faction}-support-group-boost`,
      name: names[0] ?? "攻撃力強化",
      faction,
      attribute: "attributeA",
      cardType: "support",
      cost: 2,
      duration: "untilRoundEnd",
      effects: [
        {
          effectId: "increase-group-power",
          type: "modifyPower",
          activationType: "continuous",
          scope: "groupPower",
          operation: "add",
          value: 3,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "self",
            zones: ["attackGroup"],
            allowSourceCard: false,
          },
        },
      ],
    },
    {
      id: `${faction}-support-remove-support`,
      name: names[1] ?? "サポート除去",
      faction,
      attribute: "attributeB",
      cardType: "support",
      cost: 2,
      duration: "instant",
      effects: [
        {
          effectId: "remove-opponent-support",
          type: "removeSupportCard",
          activationType: "onPlay",
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["supportCard"],
            allowSourceCard: false,
          },
        },
      ],
    },
    {
      id: `${faction}-support-reduce-mana`,
      name: names[2] ?? "みなもと減少",
      faction,
      attribute: "attributeB",
      cardType: "support",
      cost: 3,
      duration: "instant",
      effects: [
        {
          effectId: "reduce-opponent-mana",
          type: "reduceMana",
          activationType: "onPlay",
          amount: 2,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "opponent",
            zones: ["mana"],
            allowSourceCard: false,
          },
        },
      ],
    },
    {
      id: `${faction}-support-stamina`,
      name: names[3] ?? "スタミナ回復",
      faction,
      attribute: "attributeC",
      cardType: "support",
      cost: 1,
      duration: "instant",
      effects: [
        {
          effectId: "restore-stamina",
          type: "changeStamina",
          activationType: "onPlay",
          amount: 2,
          targetRule: {
            required: true,
            minTargets: 1,
            maxTargets: 1,
            side: "self",
            zones: ["player"],
            allowSourceCard: false,
          },
        },
      ],
    },
    {
      id: `${faction}-support-remove-group`,
      name: names[4] ?? "攻撃グループ除去",
      faction,
      attribute: "attributeC",
      cardType: "support",
      cost: 4,
      duration: "instant",
      effects: [
        {
          effectId: "remove-opponent-group",
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
      ],
    },
    {
      id: `${faction}-support-destroy-draw`,
      name: names[5] ?? "複合効果",
      faction,
      attribute: "attributeA",
      cardType: "support",
      cost: 5,
      duration: "instant",
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
      ],
    },
  ];
}

function createStarterDeckIds(faction: Faction): string[] {
  return [
    `${faction}-mana-1`,
    `${faction}-mana-1`,
    `${faction}-mana-1`,
    `${faction}-mana-2`,
    `${faction}-mana-2`,
    `${faction}-mana-2`,
    `${faction}-mana-3`,
    `${faction}-mana-3`,
    ...Array.from({ length: 8 }, (_, index) => [
      `${faction}-attack-${index + 1}`,
      `${faction}-attack-${index + 1}`,
    ]).flat(),
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
      return "ゲーム開始時にみなもととして配置されるカードです。";
    case "attack":
      return `必要なみなもと ${definition.cost}。基本攻撃力 ${definition.basePower}。`;
    case "support":
      return `${createDurationText(definition.duration)}。${definition.effects
        .map((effect) => {
          switch (effect.type) {
            case "modifyPower":
              return "攻撃力を変更します。";
            case "changeStamina":
              return "スタミナを変更します。";
            case "reduceMana":
              return "みなもとを減らします。";
            case "drawCards":
              return "カードを引きます。";
            case "removeAttackGroup":
              return "攻撃グループを除去します。";
            case "removeSupportCard":
              return "サポートカードを除去します。";
            case "custom":
              return "固有の効果を解決します。";
          }
        })
        .join(" ")}`;
  }
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
