import { DurableObject } from "cloudflare:workers";
import type {
  CardCatalog,
  CardCatalogVersion,
  GameId,
} from "@disastar/game-engine/contracts";

export const GAME_RECONNECT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

const ARCHIVE_STORAGE_KEY = "catalog-archive-v1";

export type CatalogRetentionLease = {
  gameId: GameId;
  catalog: CardCatalog;
  expiresAt: number | null;
};

export type RetainCatalogResult =
  | { retained: true }
  | { retained: false; error: { code: "CARD_CATALOG_VERSION_CONFLICT" } };

type StoredCatalogArchive = {
  entries: Record<string, StoredCatalogEntry>;
};

type StoredCatalogEntry = {
  catalog: CardCatalog;
  leases: Record<string, number | null>;
};

/**
 * ゲーム開始時のカタログを、進行中または再接続猶予中のゲームが参照する間だけ保持する。
 */
export class CatalogArchive extends DurableObject<CloudflareBindings> {
  private archive: StoredCatalogArchive = { entries: Object.create(null) };
  private readonly loadArchive: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadArchive = this.ctx.blockConcurrencyWhile(async () => {
      this.archive = (await this.ctx.storage.get<StoredCatalogArchive>(
        ARCHIVE_STORAGE_KEY,
      )) ?? { entries: Object.create(null) };
    });
  }

  async retain(lease: CatalogRetentionLease): Promise<RetainCatalogResult> {
    await this.loadArchive;
    await this.removeExpiredLeases(Date.now());
    assertLease(lease);

    const version = lease.catalog.version;
    const existing = this.archive.entries[version];
    if (
      existing !== undefined &&
      !areEqualJsonValues(existing.catalog, lease.catalog)
    ) {
      return {
        retained: false,
        error: { code: "CARD_CATALOG_VERSION_CONFLICT" },
      };
    }

    const entry = existing ?? {
      catalog: cloneCardCatalog(lease.catalog),
      leases: Object.create(null),
    };
    entry.leases[lease.gameId] = lease.expiresAt;
    this.archive.entries[version] = entry;
    await this.persist();
    await this.syncAlarm();
    return { retained: true };
  }

  /** 内部RPC用。HTTPでは公開DTOへ投影し、内部効果設定をそのまま返さない。 */
  async getCatalog(version: CardCatalogVersion): Promise<CardCatalog | null> {
    await this.loadArchive;
    await this.removeExpiredLeases(Date.now());
    const entry = this.archive.entries[version];
    return entry === undefined ? null : cloneCardCatalog(entry.catalog);
  }

  async alarm(): Promise<void> {
    await this.loadArchive;
    await this.removeExpiredLeases(Date.now());
  }

  private async removeExpiredLeases(now: number): Promise<void> {
    let changed = false;
    for (const [version, entry] of Object.entries(this.archive.entries)) {
      for (const [gameId, expiresAt] of Object.entries(entry.leases)) {
        if (expiresAt !== null && expiresAt <= now) {
          delete entry.leases[gameId];
          changed = true;
        }
      }
      if (Object.keys(entry.leases).length === 0) {
        delete this.archive.entries[version];
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
    }
    await this.syncAlarm();
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(ARCHIVE_STORAGE_KEY, this.archive);
  }

  private async syncAlarm(): Promise<void> {
    const expiresAt = Object.values(this.archive.entries)
      .flatMap((entry) => Object.values(entry.leases))
      .filter((value): value is number => value !== null)
      .reduce<number | null>(
        (earliest, value) =>
          earliest === null || value < earliest ? value : earliest,
        null,
      );

    if (expiresAt === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(expiresAt);
  }
}

function assertLease(lease: CatalogRetentionLease): void {
  if (
    lease.gameId.trim().length === 0 ||
    lease.catalog.version.trim().length === 0 ||
    (lease.expiresAt !== null &&
      (!Number.isSafeInteger(lease.expiresAt) || lease.expiresAt < 0))
  ) {
    throw new TypeError("カードカタログ保持リースが不正です。");
  }
}

export function cloneCardCatalog(catalog: CardCatalog): CardCatalog {
  return {
    version: catalog.version,
    definitions: Object.fromEntries(
      Object.entries(catalog.definitions).map(([definitionId, definition]) => [
        definitionId,
        structuredClone(definition),
      ]),
    ),
  } as CardCatalog;
}

function areEqualJsonValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areEqualJsonValues(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && areEqualJsonValues(left[key], right[key]),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
