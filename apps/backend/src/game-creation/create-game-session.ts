import type {
  InitializeGameError,
  InitializeGameInput,
} from "@disastar/game-engine/contracts";

export type GameSessionInitializer = {
  initialize(
    input: InitializeGameInput,
  ): Promise<
    { initialized: true } | { initialized: false; error: InitializeGameError }
  >;
};

export type CreateGameSessionInput = Pick<InitializeGameInput, "players">;

export type CreateGameSessionDependencies = {
  createGameId: () => string;
  createRandomSeed: () => string;
  getGameSession: (gameId: string) => GameSessionInitializer;
};

export type CreateGameSessionResult =
  | { created: true; gameId: string }
  | {
      created: false;
      error:
        | InitializeGameError
        | {
            code: "GENERATED_IDENTIFIER_INVALID";
            message: string;
          };
    };

/**
 * マッチング完了後の信頼済み入力からゲームセッションを初期化する。
 * プレイヤーIDの認証・相手選出・デッキ選択の認可は呼び出し元が担う。
 */
export async function createGameSession(
  input: CreateGameSessionInput,
  dependencies: CreateGameSessionDependencies,
): Promise<CreateGameSessionResult> {
  const gameId = dependencies.createGameId();
  const randomSeed = dependencies.createRandomSeed();
  if (!isNonEmptyString(gameId) || !isNonEmptyString(randomSeed)) {
    return {
      created: false,
      error: {
        code: "GENERATED_IDENTIFIER_INVALID",
        message:
          "ゲームIDと乱数seedはサーバーが空でない値を生成する必要があります。",
      },
    };
  }

  const initialized = await dependencies.getGameSession(gameId).initialize({
    gameId,
    randomSeed,
    players: input.players,
  });
  return initialized.initialized
    ? { created: true, gameId }
    : { created: false, error: initialized.error };
}

/**
 * Cloudflare Worker上の通常実装。ゲームIDと乱数seedはWeb Cryptoで生成する。
 */
export function createGameSessionInEnvironment(
  input: CreateGameSessionInput,
  environment: CloudflareBindings,
): Promise<CreateGameSessionResult> {
  return createGameSession(input, {
    createGameId: () => `game-${crypto.randomUUID()}`,
    createRandomSeed: () => crypto.randomUUID(),
    getGameSession: (gameId) =>
      environment.GAME_SESSION.getByName(
        gameId,
      ) as unknown as GameSessionInitializer,
  });
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}
