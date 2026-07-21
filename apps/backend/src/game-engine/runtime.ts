import { GAME_RULES, createCardCatalog } from "@disastar/game-engine";
import type {
  CardCatalogInput,
  GameEngineContext,
  GameEngineDependencies,
  IdGenerationInput,
} from "@disastar/game-engine/contracts";

const attributes = ["attributeA", "attributeB", "attributeC"] as const;
const ENGINE_SEMANTICS_VERSION = "engine-v1";

const developmentCatalogInput: CardCatalogInput = {
  version: "development-catalog-v1",
  definitions: [
    {
      id: "mana-a",
      name: "みなもとA",
      attribute: "attributeA",
      cardType: "mana",
      manaAmount: 1,
    },
    {
      id: "mana-b",
      name: "みなもとB",
      attribute: "attributeB",
      cardType: "mana",
      manaAmount: 1,
    },
    {
      id: "mana-c",
      name: "みなもとC",
      attribute: "attributeC",
      cardType: "mana",
      manaAmount: 1,
    },
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `attack-${index + 1}`,
      name: `攻撃カード${index + 1}`,
      attribute: attributes[index % attributes.length]!,
      cardType: "attack" as const,
      cost: 0,
      basePower: index + 1,
      chainableCardIds: [],
      effects: [],
    })),
  ],
};

const catalogResult = createCardCatalog(developmentCatalogInput, {
  rules: GAME_RULES,
  effectRegistry: {},
  engineSemanticsVersion: ENGINE_SEMANTICS_VERSION,
});

if (!catalogResult.valid) {
  throw new Error(
    `開発用カードカタログが不正です: ${catalogResult.errors
      .map((error) => error.message)
      .join(" / ")}`,
  );
}

export const gameEngineContext: GameEngineContext = {
  rules: GAME_RULES,
  cardCatalog: catalogResult.catalog,
  effectRegistry: {},
  engineSemanticsVersion: ENGINE_SEMANTICS_VERSION,
};

export const gameEngineDependencies: GameEngineDependencies = {
  random: {
    create(seed) {
      let state = hashSeed(seed);
      return {
        next() {
          state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
          return state / 4_294_967_296;
        },
      };
    },
  },
  clock: { now: () => Date.now() },
  idGenerator: {
    generate(input) {
      return `${input.kind}-${createOpaqueId(input)}`;
    },
  },
};

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }
  return hash;
}

function createOpaqueId(input: IdGenerationInput): string {
  let hash = 14_695_981_039_346_656_037n;
  const value = `${input.kind}\u001f${input.gameId}\u001f${input.seed}`;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return hash.toString(36);
}
