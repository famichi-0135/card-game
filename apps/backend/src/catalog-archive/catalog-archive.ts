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

export type CatalogRetentionLeaseRenewal = {
  gameId: GameId;
  version: CardCatalogVersion;
  expiresAt: number | null;
};

export type CatalogRetentionLeaseReference = Pick<
  CatalogRetentionLeaseRenewal,
  "gameId" | "version"
>;

export type RetainCatalogResult =
  | { retained: true }
  | { retained: false; error: { code: "CARD_CATALOG_VERSION_CONFLICT" } };

export type RenewCatalogLeaseResult =
  | { renewed: true }
  | { renewed: false; error: { code: "CARD_CATALOG_NOT_FOUND" } };

export type ReleaseCatalogLeaseResult = { released: true };

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
  // Storage失敗後はメモリ上だけ更新済みになるため、再送時の早期returnを禁止する。
  private archiveNeedsPersistence = false;
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

    if (
      existing !== undefined &&
      !this.archiveNeedsPersistence &&
      Object.prototype.hasOwnProperty.call(existing.leases, lease.gameId) &&
      existing.leases[lease.gameId] === lease.expiresAt
    ) {
      return { retained: true };
    }

    const entry = existing ?? {
      catalog: cloneCardCatalog(lease.catalog),
      leases: Object.create(null),
    };
    this.archiveNeedsPersistence = true;
    entry.leases[lease.gameId] = lease.expiresAt;
    this.archive.entries[version] = entry;
    await this.persist();
    await this.syncAlarm();
    return { retained: true };
  }

  async renewLease(
    renewal: CatalogRetentionLeaseRenewal,
  ): Promise<RenewCatalogLeaseResult> {
    await this.loadArchive;
    await this.removeExpiredLeases(Date.now());
    assertLeaseReference(renewal);

    const entry = this.archive.entries[renewal.version];
    if (entry === undefined) {
      return {
        renewed: false,
        error: { code: "CARD_CATALOG_NOT_FOUND" },
      };
    }
    if (
      !this.archiveNeedsPersistence &&
      Object.prototype.hasOwnProperty.call(entry.leases, renewal.gameId) &&
      entry.leases[renewal.gameId] === renewal.expiresAt
    ) {
      return { renewed: true };
    }

    this.archiveNeedsPersistence = true;
    entry.leases[renewal.gameId] = renewal.expiresAt;
    await this.persist();
    await this.syncAlarm();
    return { renewed: true };
  }

  async releaseLease(
    reference: CatalogRetentionLeaseReference,
  ): Promise<ReleaseCatalogLeaseResult> {
    await this.loadArchive;
    await this.removeExpiredLeases(Date.now());
    assertLeaseReference({ ...reference, expiresAt: null });

    const entry = this.archive.entries[reference.version];
    if (
      entry === undefined ||
      !Object.prototype.hasOwnProperty.call(entry.leases, reference.gameId)
    ) {
      return { released: true };
    }

    this.archiveNeedsPersistence = true;
    delete entry.leases[reference.gameId];
    if (Object.keys(entry.leases).length === 0) {
      delete this.archive.entries[reference.version];
    }
    await this.persist();
    await this.syncAlarm();
    return { released: true };
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
    for (const [version, entry] of Object.entries(this.archive.entries)) {
      for (const [gameId, expiresAt] of Object.entries(entry.leases)) {
        if (expiresAt !== null && expiresAt <= now) {
          this.archiveNeedsPersistence = true;
          delete entry.leases[gameId];
        }
      }
      if (Object.keys(entry.leases).length === 0) {
        this.archiveNeedsPersistence = true;
        delete this.archive.entries[version];
      }
    }

    if (this.archiveNeedsPersistence) {
      await this.persist();
    }
    await this.syncAlarm();
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(ARCHIVE_STORAGE_KEY, this.archive);
    this.archiveNeedsPersistence = false;
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

    const currentAlarm = await this.ctx.storage.getAlarm();

    if (expiresAt === null) {
      if (currentAlarm !== null) {
        await this.ctx.storage.deleteAlarm();
      }
      return;
    }
    if (currentAlarm !== expiresAt) {
      await this.ctx.storage.setAlarm(expiresAt);
    }
  }
}

function assertLease(lease: CatalogRetentionLease): void {
  assertLeaseReference({
    gameId: lease.gameId,
    version: lease.catalog.version,
    expiresAt: lease.expiresAt,
  });
}

function assertLeaseReference(lease: CatalogRetentionLeaseRenewal): void {
  if (
    lease.gameId.trim().length === 0 ||
    lease.version.trim().length === 0 ||
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
