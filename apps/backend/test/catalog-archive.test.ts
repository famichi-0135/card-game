import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { CardCatalog } from "@disastar/game-engine/contracts";
import {
  cloneCardCatalog,
  GAME_RECONNECT_GRACE_PERIOD_MS,
  type CatalogArchive,
} from "../src/catalog-archive/catalog-archive.js";
import { gameEngineContext } from "../src/game-engine/runtime.js";

describe("CatalogArchive Durable Object", () => {
  it("進行中のゲームと終了後24時間のゲームが参照するカタログを保持する", async () => {
    const archive = getCatalogArchive("catalog-retention-active");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const expiresAt = Date.now() + GAME_RECONNECT_GRACE_PERIOD_MS;

    await expect(
      archive.retain({
        gameId: "active-game",
        catalog,
        expiresAt: null,
      }),
    ).resolves.toEqual({ retained: true });
    await expect(
      archive.retain({
        gameId: "finished-game",
        catalog,
        expiresAt,
      }),
    ).resolves.toEqual({ retained: true });

    await expect(archive.getCatalog(catalog.version)).resolves.toEqual(catalog);
    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (_instance, state) => {
        expect(await state.storage.getAlarm()).toBe(expiresAt);
      },
    );
  });

  it("最後の再接続猶予が失効したカタログを削除する", async () => {
    const archive = getCatalogArchive("catalog-retention-expired");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);

    await archive.retain({
      gameId: "finished-game",
      catalog,
      expiresAt: Date.now() - 1,
    });

    await expect(archive.getCatalog(catalog.version)).resolves.toBeNull();
  });

  it("同じカタログバージョンに異なる内容を登録しない", async () => {
    const archive = getCatalogArchive("catalog-retention-conflict");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const conflictingCatalog = createConflictingCatalog(catalog);

    await archive.retain({
      gameId: "first-game",
      catalog,
      expiresAt: null,
    });

    await expect(
      archive.retain({
        gameId: "second-game",
        catalog: conflictingCatalog,
        expiresAt: null,
      }),
    ).resolves.toEqual({
      retained: false,
      error: { code: "CARD_CATALOG_VERSION_CONFLICT" },
    });
  });
});

type CatalogArchiveRpc = Pick<CatalogArchive, "getCatalog" | "retain">;

function getCatalogArchive(name: string): CatalogArchiveRpc {
  const archives = env.CATALOG_ARCHIVE as unknown as {
    getByName(archiveName: string): CatalogArchiveRpc;
  };
  return archives.getByName(name);
}

function createConflictingCatalog(catalog: CardCatalog): CardCatalog {
  const firstDefinition = catalog.definitions["disaster-mana-1"];
  if (firstDefinition === undefined) {
    throw new Error("テスト用のカード定義が見つかりません。");
  }

  return {
    ...catalog,
    definitions: {
      ...catalog.definitions,
      [firstDefinition.id]: {
        ...firstDefinition,
        name: "内容が異なる同一バージョンのカード",
      },
    },
  };
}
