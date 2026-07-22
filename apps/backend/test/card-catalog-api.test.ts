import { describe, expect, it } from "vitest";
import { createCardCatalogApi } from "../src/card-catalog-api/create-card-catalog-api.js";
import type { CardCatalog } from "@disastar/game-engine/contracts";
import { gameEngineContext } from "../src/game-engine/runtime.js";

describe("公開カードカタログ HTTP API", () => {
  it("現行カタログの表示文言はカード定義のpresentationを返す", async () => {
    const definition = Object.values(
      gameEngineContext.cardCatalog.definitions,
    )[0];
    if (definition === undefined || definition.presentation === undefined) {
      throw new Error("現行カタログの表示情報がありません。");
    }
    const app = createCardCatalogApi();

    const response = await app.fetch(
      new Request(
        `http://example.com/${gameEngineContext.cardCatalog.version}`,
      ),
      {} as CloudflareBindings,
    );
    const body = (await response.json()) as {
      catalog: { definitions: Record<string, { rulesText: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.catalog.definitions[definition.id]?.rulesText).toBe(
      definition.presentation.rulesText,
    );
  });

  it("表示専用 DTO を返し、内部効果設定を返さない", async () => {
    const app = createCardCatalogApi({
      getCurrentCatalog: () => testCatalog,
      getCatalogArchive: () => {
        throw new Error("現行カタログはアーカイブを参照してはいけません。");
      },
    });

    const response = await app.fetch(
      new Request("http://example.com/catalog-v1"),
      {} as CloudflareBindings,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      catalog: {
        version: "catalog-v1",
        definitions: {
          "support-1": {
            interaction: {
              effects: [
                {
                  effectId: "effect-1",
                  target: { zones: ["attackGroup"] },
                },
              ],
            },
          },
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("private-handler");
    expect(JSON.stringify(body)).not.toContain("privateValue");
  });

  it("保持されていないバージョンは404で返す", async () => {
    const app = createCardCatalogApi({
      getCurrentCatalog: () => testCatalog,
      getCatalogArchive: () => ({
        getCatalog: async () => null,
      }),
    });

    const response = await app.fetch(
      new Request("http://example.com/missing"),
      {} as CloudflareBindings,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "CARD_CATALOG_NOT_FOUND" },
    });
  });

  it("過去バージョンは保持アーカイブから返す", async () => {
    const archivedCatalog = {
      ...testCatalog,
      version: "catalog-v0",
    } as CardCatalog;
    const app = createCardCatalogApi({
      getCurrentCatalog: () => testCatalog,
      getCatalogArchive: () => ({
        getCatalog: async (version) =>
          version === "catalog-v0" ? archivedCatalog : null,
      }),
    });

    const response = await app.fetch(
      new Request("http://example.com/catalog-v0"),
      {} as CloudflareBindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      catalog: { version: "catalog-v0" },
    });
  });
});

const testCatalog = {
  version: "catalog-v1",
  definitions: {
    "support-1": {
      id: "support-1",
      name: "公開テストカード",
      faction: "disaster",
      attribute: "attributeA",
      cardType: "support",
      cost: 2,
      duration: "instant",
      effects: [
        {
          effectId: "effect-1",
          type: "custom",
          handlerId: "private-handler",
          config: { privateValue: true },
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
  },
} as unknown as CardCatalog;
