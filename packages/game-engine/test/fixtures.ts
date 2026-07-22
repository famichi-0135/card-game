import { GAME_RULES, createCardCatalog } from "../src/index.js";
import type {
  CardCatalog,
  CardCatalogInput,
  Faction,
  GameEngineContext,
  GameEngineDependencies,
  InitializeGameInput,
  RandomGenerator,
} from "../src/contracts/index.js";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;

export function createTestCardCatalogInput(): CardCatalogInput {
  const disasterDefinitions: CardCatalogInput["definitions"] = [
    {
      id: "mana-a",
      name: "災害みなもとA",
      faction: "disaster",
      attribute: "attributeA",
      cardType: "mana",
      manaAmount: 1,
    },
    {
      id: "mana-b",
      name: "災害みなもとB",
      faction: "disaster",
      attribute: "attributeB",
      cardType: "mana",
      manaAmount: 1,
    },
    {
      id: "mana-c",
      name: "災害みなもとC",
      faction: "disaster",
      attribute: "attributeC",
      cardType: "mana",
      manaAmount: 1,
    },
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `attack-${index + 1}`,
      name: `災害攻撃カード${index + 1}`,
      faction: "disaster" as const,
      attribute: attributes[
        index % attributes.length
      ] as (typeof attributes)[number],
      cardType: "attack" as const,
      cost: 0,
      basePower: index + 1,
      chainableCardIds: [],
      effects: [],
    })),
  ];

  const countermeasureDefinitions = disasterDefinitions.map((definition) => ({
    ...definition,
    id: `counter-${definition.id}`,
    name: definition.name.replace("災害", "対策"),
    faction: "countermeasure" as const,
    ...(definition.cardType === "attack"
      ? {
          chainableCardIds: definition.chainableCardIds.map(
            (id) => `counter-${id}`,
          ),
        }
      : {}),
  })) as CardCatalogInput["definitions"];

  return {
    version: "card-catalog-v1",
    definitions: [...disasterDefinitions, ...countermeasureDefinitions],
  };
}

export function createTestCatalog(): CardCatalog {
  const result = createCardCatalog(createTestCardCatalogInput(), {
    rules: GAME_RULES,
    effectRegistry: {},
    engineSemanticsVersion: "engine-v1",
  });

  if (!result.valid) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }

  return result.catalog;
}

export function createTestContext(
  cardCatalog: CardCatalog = createTestCatalog(),
): GameEngineContext {
  return {
    rules: GAME_RULES,
    cardCatalog,
    effectRegistry: {},
    engineSemanticsVersion: "engine-v1",
  };
}

export function createValidDeckDefinitionIds(
  faction: Faction = "disaster",
): string[] {
  const disasterDeck = [
    "mana-a",
    "mana-a",
    "mana-a",
    "mana-b",
    "attack-1",
    "mana-b",
    "mana-b",
    "mana-c",
    "mana-c",
    "attack-1",
    ...Array.from({ length: 10 }, (_, index) => [
      `attack-${index + 2}`,
      `attack-${index + 2}`,
    ]).flat(),
  ];
  return faction === "disaster"
    ? disasterDeck
    : disasterDeck.map((id) => `counter-${id}`);
}

export function createAllManaOpeningDeckDefinitionIds(
  faction: Faction = "disaster",
): string[] {
  const disasterDeck = [
    "mana-a",
    "mana-a",
    "mana-a",
    "mana-b",
    "mana-b",
    "mana-b",
    "mana-c",
    "mana-c",
    ...Array.from({ length: 11 }, (_, index) => [
      `attack-${index + 1}`,
      `attack-${index + 1}`,
    ]).flat(),
  ];
  return faction === "disaster"
    ? disasterDeck
    : disasterDeck.map((id) => `counter-${id}`);
}

export function createInitializationInput(
  deckDefinitionIds: string[] = createValidDeckDefinitionIds(),
): InitializeGameInput {
  return {
    gameId: "game-1",
    randomSeed: "seed-1",
    players: [
      {
        playerId: "player-1",
        faction: "disaster",
        deckDefinitionIds: [...deckDefinitionIds],
      },
      {
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: deckDefinitionIds.map((id) => `counter-${id}`),
      },
    ],
  };
}

export function createDependencies(
  random: RandomGenerator = createSeededRandomGenerator(),
): GameEngineDependencies {
  return {
    random,
    clock: { now: () => 1_000 },
    idGenerator: {
      generate: (input) => `${input.kind}:${input.seed}`,
    },
  };
}

export function createSeededRandomGenerator(): RandomGenerator {
  return {
    create: (seed) => {
      let state = hashSeed(seed);
      return {
        next: () => {
          state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
          return state / 4_294_967_296;
        },
      };
    },
  };
}

export function createSequenceRandomGenerator(
  values: readonly number[],
  onNext?: () => void,
): RandomGenerator {
  return {
    create: () => {
      let index = 0;
      return {
        next: () => {
          onNext?.();
          const value = values[index];
          index += 1;
          if (value === undefined) {
            throw new Error("テスト用乱数列が不足しています。");
          }
          return value;
        },
      };
    },
  };
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }
  return hash;
}
