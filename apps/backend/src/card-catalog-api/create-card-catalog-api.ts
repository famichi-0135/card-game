import { Hono } from "hono";
import { projectPublicCardCatalog } from "@disastar/game-engine";
import type {
  CardCatalog,
  CardCatalogVersion,
} from "@disastar/game-engine/contracts";
import type {
  PublicCardCatalogApiErrorResponse,
  PublicCardCatalogResponse,
} from "@disastar/contracts/game";
import type { BetterAuthEnvironment } from "../auth/runtime-auth.js";
import { gameEngineContext } from "../game-engine/runtime.js";

type CardCatalogApiEnvironment = {
  Bindings: BetterAuthEnvironment;
};

type CatalogArchiveRpc = {
  getCatalog(version: CardCatalogVersion): Promise<CardCatalog | null>;
};

type CatalogArchiveResolver = (
  environment: CloudflareBindings,
) => CatalogArchiveRpc;

export type CardCatalogApiDependencies = {
  getCatalogArchive?: CatalogArchiveResolver;
  getCurrentCatalog?: () => CardCatalog;
};

/** 認証不要の表示専用カードカタログ API。内部効果定義は返さない。 */
export function createCardCatalogApi({
  getCatalogArchive = resolveCatalogArchive,
  getCurrentCatalog = () => gameEngineContext.cardCatalog,
}: CardCatalogApiDependencies = {}): Hono<CardCatalogApiEnvironment> {
  const api = new Hono<CardCatalogApiEnvironment>();

  api.get("/:cardCatalogVersion", async (c) => {
    const cardCatalogVersion = c.req.param("cardCatalogVersion");
    const currentCatalog = getCurrentCatalog();
    const catalog =
      currentCatalog.version === cardCatalogVersion
        ? currentCatalog
        : await getCatalogArchive(c.env).getCatalog(cardCatalogVersion);
    if (catalog === null) {
      return c.json(
        {
          error: { code: "CARD_CATALOG_NOT_FOUND" },
        } satisfies PublicCardCatalogApiErrorResponse,
        404,
      );
    }
    return c.json({
      catalog: projectPublicCardCatalog(catalog),
    } satisfies PublicCardCatalogResponse);
  });

  return api;
}

function resolveCatalogArchive(
  environment: CloudflareBindings,
): CatalogArchiveRpc {
  return environment.CATALOG_ARCHIVE.getByName(
    "card-catalog-retention",
  ) as unknown as CatalogArchiveRpc;
}
