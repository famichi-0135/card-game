import {
  getAvailableGameActions,
  type AvailableGameActions,
  type PlayerGameView,
  type PublicCardCatalog,
} from "@disastar/game-engine";

export const FIXTURE_GAME_ID = "demo";

export type GameBoardFixture = {
  catalog: PublicCardCatalog;
  view: PlayerGameView;
  availableActions: AvailableGameActions;
};

export type GameBoardFixtureScenario = "placement" | "support";

export function createGameBoardFixture(
  gameId: string,
  scenario: GameBoardFixtureScenario = "placement",
): GameBoardFixture {
  const now = Date.now();
  const catalog = createCatalog();
  const view = createView(gameId, now, scenario);

  return {
    catalog,
    view,
    availableActions: getAvailableGameActions({ view, catalog, now }),
  };
}

function createCatalog(): PublicCardCatalog {
  return {
    version: "catalog-preview-v1",
    definitions: {
      "attack-flood": {
        id: "attack-flood",
        name: "河川の氾濫",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "attack",
        cost: 2,
        basePower: 4,
        rulesText: "河川の氾濫を起こし、地域に影響を与える。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: ["attack-storm"],
          effects: [],
        },
      },
      "attack-storm": {
        id: "attack-storm",
        name: "暴風雨",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "attack",
        cost: 3,
        basePower: 5,
        rulesText: "暴風雨を連鎖させ、被害を拡大する。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: ["attack-flood"],
          effects: [],
        },
      },
      "attack-earthquake": {
        id: "attack-earthquake",
        name: "地震",
        faction: "disaster",
        attribute: "attributeB",
        cardType: "attack",
        cost: 4,
        basePower: 6,
        rulesText: "強い揺れにより、建物とライフラインへ影響を与える。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "support-evacuation": {
        id: "support-evacuation",
        name: "避難所開設",
        faction: "disaster",
        attribute: "attributeC",
        cardType: "support",
        cost: 1,
        duration: "untilRoundEnd",
        rulesText: "避難所を開設し、対象の攻撃グループへ対応する。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [
            {
              effectId: "select-attack-group",
              activationType: "onPlay",
              target: {
                required: true,
                minTargets: 1,
                maxTargets: 1,
                side: "opponent",
                zones: ["attackGroup"],
                allowSourceCard: false,
                selectionOrder: "independent",
              },
            },
          ],
        },
      },
      "mana-river": {
        id: "mana-river",
        name: "河川資源",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "mana",
        manaAmount: 1,
        rulesText: "属性Aのみなもとを増やす。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "counter-barrier": {
        id: "counter-barrier",
        name: "水防堤",
        faction: "countermeasure",
        attribute: "attributeA",
        cardType: "attack",
        cost: 2,
        basePower: 3,
        rulesText: "水害に備える防御線を構築する。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "counter-alert": {
        id: "counter-alert",
        name: "避難情報",
        faction: "countermeasure",
        attribute: "attributeC",
        cardType: "support",
        cost: 1,
        duration: "instant",
        rulesText: "避難情報を発令し、地域へ注意を促す。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
    },
  };
}

function createView(
  gameId: string,
  now: number,
  scenario: GameBoardFixtureScenario,
): PlayerGameView {
  const isSupportScenario = scenario === "support";

  return {
    gameId,
    rulesetVersion: "ruleset-v2-factions",
    cardCatalogVersion: "catalog-preview-v1",
    stateVersion: isSupportScenario ? 14 : 12,
    status: "active",
    round: 3,
    phase: isSupportScenario ? "support" : "firstPlayerPlacement",
    phaseSequence: isSupportScenario ? 9 : 7,
    phaseDeadlineAt: now + 78_000,
    firstPlayerId: "player-disaster",
    secondPlayerId: "player-countermeasure",
    viewerPlayerId: "player-disaster",
    self: {
      playerId: "player-disaster",
      faction: "disaster",
      stamina: 18,
      hand: [
        {
          instanceId: "hand-flood",
          definitionId: "attack-flood",
          ownerId: "player-disaster",
        },
        {
          instanceId: "hand-storm",
          definitionId: "attack-storm",
          ownerId: "player-disaster",
        },
        {
          instanceId: "hand-earthquake",
          definitionId: "attack-earthquake",
          ownerId: "player-disaster",
        },
        {
          instanceId: "hand-evacuation",
          definitionId: "support-evacuation",
          ownerId: "player-disaster",
        },
      ],
      handCount: 4,
      deckCount: 16,
      discardPile: [
        {
          instanceId: "discard-river",
          definitionId: "mana-river",
          ownerId: "player-disaster",
        },
      ],
      attackGroups: [
        {
          groupId: "self-group-1",
          ownerId: "player-disaster",
          slotIndex: 2,
          attribute: "attributeA",
          createdRound: 2,
          cards: [
            {
              instanceId: "field-flood",
              definitionId: "attack-flood",
              ownerId: "player-disaster",
            },
            {
              instanceId: "field-storm",
              definitionId: "attack-storm",
              ownerId: "player-disaster",
            },
          ],
          requiredMana: 3,
          currentPower: 9,
        },
      ],
      supportZone: [
        {
          instanceId: "support-on-field",
          definitionId: "support-evacuation",
          ownerId: "player-disaster",
        },
      ],
      mana: createMana(8, 4, 6, 1, 2, 1),
      activeEffects: [],
      supportFinished: false,
    },
    opponent: {
      playerId: "player-countermeasure",
      faction: "countermeasure",
      stamina: 21,
      handCount: 5,
      deckCount: 17,
      discardPile: [
        {
          instanceId: "opponent-discard-barrier",
          definitionId: "counter-barrier",
          ownerId: "player-countermeasure",
        },
      ],
      attackGroups: [
        {
          groupId: "opponent-group-1",
          ownerId: "player-countermeasure",
          slotIndex: 1,
          attribute: "attributeA",
          createdRound: 2,
          cards: [
            {
              instanceId: "opponent-barrier",
              definitionId: "counter-barrier",
              ownerId: "player-countermeasure",
            },
          ],
          requiredMana: 2,
          currentPower: 3,
        },
      ],
      supportZone: [
        {
          instanceId: "opponent-alert",
          definitionId: "counter-alert",
          ownerId: "player-countermeasure",
        },
      ],
      mana: createMana(5, 2, 2, 2, 4, 4),
      activeEffects: [],
      supportFinished: false,
    },
    lastRoundResult: null,
    winner: null,
  };
}

function createMana(
  attributeATotal: number,
  attributeAReserved: number,
  attributeBTotal: number,
  attributeBReserved: number,
  attributeCTotal: number,
  attributeCReserved: number,
) {
  return {
    attributeA: {
      total: attributeATotal,
      reserved: attributeAReserved,
      available: attributeATotal - attributeAReserved,
    },
    attributeB: {
      total: attributeBTotal,
      reserved: attributeBReserved,
      available: attributeBTotal - attributeBReserved,
    },
    attributeC: {
      total: attributeCTotal,
      reserved: attributeCReserved,
      available: attributeCTotal - attributeCReserved,
    },
  };
}
