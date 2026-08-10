import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
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

  it("同一リースの再主張では保存済みアーカイブを書き直さない", async () => {
    const archive = getCatalogArchive("catalog-retention-idempotent");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const lease = {
      gameId: "idempotent-game",
      catalog,
      expiresAt: Date.now() + GAME_RECONNECT_GRACE_PERIOD_MS,
    };

    await expect(archive.retain(lease)).resolves.toEqual({ retained: true });

    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (instance, state) => {
        await state.storage.deleteAlarm();
        const internals = instance as unknown as CatalogArchiveInternals;
        const originalPersist = internals.persist.bind(internals);
        let persistCount = 0;
        internals.persist = async () => {
          persistCount += 1;
          await originalPersist();
        };

        await expect(internals.retain(lease)).resolves.toEqual({
          retained: true,
        });
        expect(persistCount).toBe(0);
        expect(await state.storage.getAlarm()).toBe(lease.expiresAt);
      },
    );
  });

  it("保存失敗後の同一リース再送では未永続のアーカイブを書き直す", async () => {
    const archive = getCatalogArchive("catalog-retention-persist-recovery");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const lease = {
      gameId: "persist-recovery-game",
      catalog,
      expiresAt: Date.now() + GAME_RECONNECT_GRACE_PERIOD_MS,
    };

    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (instance) => {
        const internals = instance as unknown as CatalogArchiveInternals;
        const originalPersist = internals.persist.bind(internals);
        let shouldFail = true;
        internals.persist = async () => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error("simulated catalog archive persistence failure");
          }
          await originalPersist();
        };

        await expect(internals.retain(lease)).rejects.toThrow(
          "simulated catalog archive persistence failure",
        );
      },
    );

    await expect(archive.retain(lease)).resolves.toEqual({ retained: true });
    await evictDurableObject(archive as unknown as DurableObjectStub);
    await expect(archive.getCatalog(catalog.version)).resolves.toEqual(catalog);
  });

  it("進行中リースを終了後の保持期限へ更新してAlarmを設定する", async () => {
    const archive = getCatalogArchive("catalog-retention-expiry-transition");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const gameId = "expiry-transition-game";
    const expiresAt = Date.now() + GAME_RECONNECT_GRACE_PERIOD_MS;

    await archive.retain({ gameId, catalog, expiresAt: null });
    await archive.retain({ gameId, catalog, expiresAt });

    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (_instance, state) => {
        expect(await state.storage.getAlarm()).toBe(expiresAt);
      },
    );
    await evictDurableObject(archive as unknown as DurableObjectStub);
    await expect(archive.getCatalog(catalog.version)).resolves.toEqual(catalog);
    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (_instance, state) => {
        expect(await state.storage.getAlarm()).toBe(expiresAt);
      },
    );
  });

  it("既存カタログのリースをバージョン指定だけで追加・更新する", async () => {
    const archive = getCatalogArchive("catalog-retention-lightweight-renewal");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);
    const expiresAt = Date.now() + GAME_RECONNECT_GRACE_PERIOD_MS;

    await archive.retain({
      gameId: "catalog-owner-game",
      catalog,
      expiresAt: null,
    });
    await expect(
      archive.renewLease({
        gameId: "renewed-game",
        version: catalog.version,
        expiresAt,
      }),
    ).resolves.toEqual({ renewed: true });

    await evictDurableObject(archive as unknown as DurableObjectStub);
    await expect(archive.getCatalog(catalog.version)).resolves.toEqual(catalog);
    await runInDurableObject(
      archive as unknown as DurableObjectStub,
      async (instance, state) => {
        const entry = (instance as unknown as CatalogArchiveInternals).archive
          .entries[catalog.version];
        expect(entry?.leases["renewed-game"]).toBe(expiresAt);
        expect(await state.storage.getAlarm()).toBe(expiresAt);
      },
    );
  });

  it("存在しないカタログ版の軽量リース更新はfallback可能な結果を返す", async () => {
    const archive = getCatalogArchive("catalog-retention-renewal-missing");

    await expect(
      archive.renewLease({
        gameId: "missing-version-game",
        version: "missing-catalog-version",
        expiresAt: null,
      }),
    ).resolves.toEqual({
      renewed: false,
      error: { code: "CARD_CATALOG_NOT_FOUND" },
    });
  });

  it("ゲーム単位でリースを冪等に解放し、最後の参照でカタログを削除する", async () => {
    const archive = getCatalogArchive("catalog-retention-release");
    const catalog = cloneCardCatalog(gameEngineContext.cardCatalog);

    await archive.retain({ gameId: "game-1", catalog, expiresAt: null });
    await archive.retain({ gameId: "game-2", catalog, expiresAt: null });

    await expect(
      archive.releaseLease({
        gameId: "game-1",
        version: catalog.version,
      }),
    ).resolves.toEqual({ released: true });
    await expect(archive.getCatalog(catalog.version)).resolves.toEqual(catalog);
    await expect(
      archive.releaseLease({
        gameId: "game-2",
        version: catalog.version,
      }),
    ).resolves.toEqual({ released: true });
    await expect(archive.getCatalog(catalog.version)).resolves.toBeNull();
    await expect(
      archive.releaseLease({
        gameId: "game-2",
        version: catalog.version,
      }),
    ).resolves.toEqual({ released: true });
  });
});

type CatalogArchiveRpc = Pick<
  CatalogArchive,
  "getCatalog" | "releaseLease" | "renewLease" | "retain"
>;

type CatalogArchiveInternals = CatalogArchiveRpc & {
  archive: {
    entries: Record<
      string,
      { leases: Record<string, number | null> } | undefined
    >;
  };
  persist(): Promise<void>;
};

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
