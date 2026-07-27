import {
  getAvailableGameActions,
  type AvailableGameActions,
  type PlayerGameView,
  type PlayerVisibleEventEnvelope,
  type PublicCardCatalog,
} from "@disastar/game-engine";

export const FIXTURE_GAME_ID = "demo";

export type GameBoardFixture = {
  catalog: PublicCardCatalog;
  events: PlayerVisibleEventEnvelope[];
  latestEventSequence: number;
  view: PlayerGameView;
  availableActions: AvailableGameActions;
};

export type GameBoardFixtureScenario = "placement" | "support" | "finished";

export function createGameBoardFixture(
  gameId: string,
  scenario: GameBoardFixtureScenario = "placement",
): GameBoardFixture {
  const now = Date.now();
  const catalog = createCatalog();
  const view = createView(gameId, now, scenario);
  const events = createEvents(view, now);

  return {
    catalog,
    events,
    latestEventSequence: events[events.length - 1]?.sequence ?? 0,
    view,
    availableActions: getAvailableGameActions({ view, catalog, now }),
  };
}

function createEvents(
  view: PlayerGameView,
  now: number,
): PlayerVisibleEventEnvelope[] {
  const finalEvent: PlayerVisibleEventEnvelope["event"] =
    view.status === "finished" && view.winner !== null
      ? { type: "GAME_FINISHED", winner: view.winner }
      : {
          type: "PHASE_CHANGED",
          phase: view.phase,
          phaseSequence: view.phaseSequence,
          deadlineAt: view.phaseDeadlineAt,
        };

  return [
    {
      sequence: 21,
      stateVersion: view.stateVersion - 2,
      occurredAt: now - 5_000,
      event: {
        type: "CARD_DISCARDED",
        playerId: view.self.playerId,
        cardInstanceId: "discard-river",
      },
    },
    {
      sequence: 22,
      stateVersion: view.stateVersion - 1,
      occurredAt: now - 3_000,
      event: {
        type: "ATTACK_GROUP_CREATED",
        playerId: view.opponent.playerId,
        groupId: "opponent-group-1",
        cardInstanceId: "opponent-barrier",
      },
    },
    {
      sequence: 23,
      stateVersion: view.stateVersion,
      occurredAt: now - 1_000,
      event: finalEvent,
    },
  ];
}

function createCatalog(): PublicCardCatalog {
  return {
    version: "catalog-preview-v2-learning-content",
    definitions: {
      "attack-flood": {
        id: "attack-flood",
        name: "直下型地震",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "attack",
        cost: 2,
        basePower: 4,
        rulesText:
          "陸域の活断層がズレることで発生する地震です。震源が浅いため、都市部の真下で起きると局所的に激しい揺れとなります。\n\nゲーム上の効果: 必要なみなもと 2。基本攻撃力 4。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: ["attack-storm"],
          effects: [],
        },
      },
      "attack-storm": {
        id: "attack-storm",
        name: "海溝型巨大地震",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "attack",
        cost: 3,
        basePower: 5,
        rulesText:
          "海のプレートが陸のプレートの下に沈み込む境界で起きる超巨大地震です。広い範囲に強い揺れをもたらします。\n\nゲーム上の効果: 必要なみなもと 3。基本攻撃力 5。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: ["attack-flood"],
          effects: [],
        },
      },
      "attack-earthquake": {
        id: "attack-earthquake",
        name: "河川の氾濫",
        faction: "disaster",
        attribute: "attributeB",
        cardType: "attack",
        cost: 4,
        basePower: 6,
        rulesText:
          "集中豪雨や台風で多量の雨が河川に流れ込むと、河川が氾濫し水があふれ出すことがあります。\n\nゲーム上の効果: 必要なみなもと 4。基本攻撃力 6。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "support-evacuation": {
        id: "support-evacuation",
        name: "猛烈な偏西風",
        faction: "disaster",
        attribute: "attributeC",
        cardType: "support",
        cost: 1,
        duration: "untilRoundEnd",
        rulesText:
          "日本の上空を流れる強い西風が、噴出した火山灰を東側の都市部へと運びます。\n\nゲーム上の効果: 使用後、対象の攻撃グループを選択します。",
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
        name: "大地のみなもと",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "mana",
        manaAmount: 1,
        rulesText:
          "地震、土砂災害、火山噴火など、大地の変動から生まれる災害の力です。\n\nゲーム上の効果: 引いた直後に対応属性のみなもと総量を1増やし、捨て札へ移動します。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "counter-barrier": {
        id: "counter-barrier",
        name: "家具の固定・転倒防止",
        faction: "countermeasure",
        attribute: "attributeA",
        cardType: "attack",
        cost: 2,
        basePower: 3,
        rulesText:
          "L字金具や突っ張り棒でタンスや本棚を固定し、大地震でのケガや避難経路の遮断を防ぎます。\n\nゲーム上の効果: 必要なみなもと 2。基本攻撃力 3。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [],
        },
      },
      "counter-alert": {
        id: "counter-alert",
        name: "緊急安全確保（警戒レベル5）",
        faction: "countermeasure",
        attribute: "attributeC",
        cardType: "support",
        cost: 1,
        duration: "instant",
        rulesText:
          "災害が発生または切迫している状況で、命を守る最善の行動を即座に促す最終警告です。\n\nゲーム上の効果: 使用後すぐに解決されます。",
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
  const isFinishedScenario = scenario === "finished";

  return {
    gameId,
    rulesetVersion: "ruleset-v3-starter-balance",
    cardCatalogVersion: "catalog-preview-v2-learning-content",
    stateVersion: isFinishedScenario ? 18 : isSupportScenario ? 14 : 12,
    status: isFinishedScenario ? "finished" : "active",
    round: isFinishedScenario ? 5 : 3,
    phase: isFinishedScenario
      ? "finished"
      : isSupportScenario
        ? "support"
        : "firstPlayerPlacement",
    phaseSequence: isFinishedScenario ? 12 : isSupportScenario ? 9 : 7,
    phaseDeadlineAt: isFinishedScenario ? null : now + 78_000,
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
    lastRoundResult: isFinishedScenario
      ? {
          round: 5,
          firstPlayerId: "player-disaster",
          secondPlayerId: "player-countermeasure",
          totalPowers: {
            "player-disaster": 11,
            "player-countermeasure": 8,
          },
          staminaBefore: {
            "player-disaster": 18,
            "player-countermeasure": 21,
          },
          staminaAfter: {
            "player-disaster": 18,
            "player-countermeasure": 21,
          },
          higherPowerPlayerId: "player-disaster",
          nextFirstPlayerId: null,
        }
      : null,
    winner: isFinishedScenario
      ? {
          type: "player",
          playerId: "player-disaster",
          reason: "maxRoundPower",
        }
      : null,
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
