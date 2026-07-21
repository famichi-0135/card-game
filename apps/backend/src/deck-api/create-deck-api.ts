import { Hono, type Context } from "hono";
import {
  parseCreateDeckRequest,
  parseReplaceDeckRequest,
  type CreateDeckResponse,
  type DeckApiErrorResponse,
  type GetDeckResponse,
  type ListDecksResponse,
  type ReplaceDeckResponse,
} from "@disastar/contracts/deck";
import { validateDeck } from "@disastar/game-engine";
import type {
  DeckValidationError,
  PlayerId,
} from "@disastar/game-engine/contracts";
import { gameEngineContext } from "../game-engine/runtime.js";
import {
  getPlayerDecksInEnvironment,
  type PlayerDecksRpc,
} from "../player-decks/player-decks.js";

type DeckApiEnvironment = {
  Bindings: CloudflareBindings;
  Variables: { authenticatedPlayerId: PlayerId };
};

/** 実際の認証方式に依存しない、保存済みデッキ API の認証境界。 */
export type DeckRequestAuthenticator = (
  request: Request,
) => Promise<PlayerId | null>;

export type PlayerDecksResolver = (
  playerId: PlayerId,
  environment: CloudflareBindings,
) => PlayerDecksRpc;

export type DeckApiDependencies = {
  authenticate: DeckRequestAuthenticator;
  getPlayerDecks?: PlayerDecksResolver;
  now?: () => number;
};

export function createDeckApi({
  authenticate,
  getPlayerDecks = getPlayerDecksInEnvironment,
  now = Date.now,
}: DeckApiDependencies): Hono<DeckApiEnvironment> {
  const api = new Hono<DeckApiEnvironment>();

  api.use("*", async (c, next) => {
    const authenticatedPlayerId = await authenticate(c.req.raw);
    if (
      authenticatedPlayerId === null ||
      authenticatedPlayerId.trim().length === 0
    ) {
      return c.json(
        { error: { code: "UNAUTHENTICATED" } } satisfies DeckApiErrorResponse,
        401,
      );
    }
    c.set("authenticatedPlayerId", authenticatedPlayerId);
    await next();
  });

  api.get("/", async (c) => {
    const decks = await getPlayerDecks(
      c.var.authenticatedPlayerId,
      c.env,
    ).list();
    return c.json({ decks } satisfies ListDecksResponse);
  });

  api.post("/", async (c) => {
    const parsed = await parseRequest(c.req.raw, parseCreateDeckRequest);
    if (!parsed.parsed) {
      return invalidRequest(c, parsed.errors);
    }
    const invalidDeck = validateSubmittedDeck(parsed.request.cardDefinitionIds);
    if (invalidDeck !== null) {
      return invalidDeckResponse(c, invalidDeck);
    }

    const deck = await getPlayerDecks(
      c.var.authenticatedPlayerId,
      c.env,
    ).create({ ...parsed.request, createdAt: now() });
    return c.json({ deck } satisfies CreateDeckResponse, 201);
  });

  api.get("/:deckId", async (c) => {
    const deck = await getPlayerDecks(c.var.authenticatedPlayerId, c.env).get(
      c.req.param("deckId"),
    );
    return deck === null
      ? deckNotFound(c)
      : c.json({ deck } satisfies GetDeckResponse);
  });

  api.put("/:deckId", async (c) => {
    const parsed = await parseRequest(c.req.raw, parseReplaceDeckRequest);
    if (!parsed.parsed) {
      return invalidRequest(c, parsed.errors);
    }
    const invalidDeck = validateSubmittedDeck(parsed.request.cardDefinitionIds);
    if (invalidDeck !== null) {
      return invalidDeckResponse(c, invalidDeck);
    }

    const deck = await getPlayerDecks(
      c.var.authenticatedPlayerId,
      c.env,
    ).replace(c.req.param("deckId"), { ...parsed.request, updatedAt: now() });
    return deck === null
      ? deckNotFound(c)
      : c.json({ deck } satisfies ReplaceDeckResponse);
  });

  api.delete("/:deckId", async (c) => {
    const removed = await getPlayerDecks(
      c.var.authenticatedPlayerId,
      c.env,
    ).remove(c.req.param("deckId"));
    return removed ? c.body(null, 204) : deckNotFound(c);
  });

  return api;
}

async function parseRequest<T>(
  request: Request,
  parse: (
    input: unknown,
  ) =>
    | { parsed: true; request: T }
    | { parsed: false; errors: DeckApiErrorResponse["errors"] },
): Promise<
  | { parsed: true; request: T }
  | { parsed: false; errors: DeckApiErrorResponse["errors"] }
> {
  try {
    return parse(await request.json());
  } catch {
    return {
      parsed: false,
      errors: [
        {
          code: "INVALID_DECK_REQUEST",
          message: "リクエスト本文はJSONとして解析できません。",
          path: "",
        },
      ],
    };
  }
}

function validateSubmittedDeck(
  cardDefinitionIds: string[],
): DeckValidationError[] | null {
  const validation = validateDeck(
    cardDefinitionIds,
    gameEngineContext.cardCatalog,
    gameEngineContext.rules,
  );
  return validation.valid ? null : validation.errors;
}

function invalidRequest(
  context: Context<DeckApiEnvironment>,
  errors: DeckApiErrorResponse["errors"],
): Response {
  return context.json(
    {
      error: { code: "INVALID_REQUEST" },
      errors,
    } satisfies DeckApiErrorResponse,
    400,
  );
}

function invalidDeckResponse(
  context: Context<DeckApiEnvironment>,
  deckValidationErrors: DeckValidationError[],
): Response {
  return context.json(
    {
      error: { code: "DECK_VALIDATION_FAILED" },
      deckValidationErrors,
    } satisfies DeckApiErrorResponse,
    422,
  );
}

function deckNotFound(context: Context<DeckApiEnvironment>): Response {
  return context.json(
    { error: { code: "DECK_NOT_FOUND" } } satisfies DeckApiErrorResponse,
    404,
  );
}
