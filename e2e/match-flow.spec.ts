import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

type GameSnapshot = {
  latestEventSequence: number;
  view: {
    cardCatalogVersion: string;
    gameId: string;
    phase:
      | "firstPlayerPlacement"
      | "secondPlayerPlacement"
      | "support"
      | "finished";
    phaseSequence: number;
    stateVersion: number;
    status: "active" | "finished";
    viewerPlayerId: string;
    firstPlayerId: string;
    secondPlayerId: string;
    self: PlayerView;
    opponent: PlayerView;
  };
};

type VisibleCard = {
  instanceId: string;
  definitionId: string;
};

type PlayerView = {
  playerId: string;
  hand: VisibleCard[];
  discardPile: VisibleCard[];
  supportZone: VisibleCard[];
  attackGroups: Array<{ groupId: string; cards: VisibleCard[] }>;
  mana: Record<
    "attributeA" | "attributeB" | "attributeC",
    { available: number }
  >;
  supportFinished: boolean;
};

type PublicCardCatalog = {
  definitions: Record<
    string,
    {
      attribute: "attributeA" | "attributeB" | "attributeC";
      cardType: "attack" | "mana" | "support";
      cost?: number;
      name: string;
      interaction: {
        effects: Array<{
          effectId: string;
          target: {
            allowSourceCard: boolean;
            minTargets: number;
            side: "self" | "opponent" | "either";
            zones: Array<
              "attackCard" | "attackGroup" | "supportCard" | "player" | "mana"
            >;
          };
        }>;
      };
    }
  >;
};

type EffectInput = {
  effectId: string;
  targets: EffectTarget[];
};

type EffectTarget =
  | { type: "attackCard"; cardInstanceId: string }
  | { type: "attackGroup"; groupId: string }
  | { type: "supportCard"; cardInstanceId: string }
  | { type: "player"; playerId: string }
  | {
      type: "mana";
      playerId: string;
      attribute: "attributeA" | "attributeB" | "attributeC";
    };

type Command = {
  commandId: string;
  gameId: string;
  playerId: string;
  phaseSequence: number;
  clientStateVersion: number;
  issuedAt: number;
  type:
    | "DISCARD_HAND_CARD"
    | "FINISH_PLACEMENT"
    | "FINISH_SUPPORT"
    | "PLACE_ATTACK_CARD"
    | "PLAY_SUPPORT_CARD";
  cardInstanceId?: string;
  effectInputs?: EffectInput[];
  slotIndex?: number;
};

test.describe("二人対戦の完全統合フロー", () => {
  test.setTimeout(180_000);

  test("独立した認証セッションで招待、参加、盤面操作、再接続、勝敗確定を完了する", async ({
    browser,
  }) => {
    const ownerContext = await createGameContext(browser);
    const opponentContext = await createGameContext(browser);
    const ownerPage = await ownerContext.newPage();
    let opponentPage = await opponentContext.newPage();

    try {
      await signInAsGuest(ownerPage, "/");
      await expect(
        ownerPage.getByRole("heading", { name: "対戦部屋を作成" }),
      ).toBeVisible();

      await ownerPage
        .getByText("招待のみ")
        .locator("..")
        .getByRole("button", { name: "災害側", exact: true })
        .click();
      await expect(ownerPage).toHaveURL(/\/rooms\/[A-Za-z0-9_-]+$/);
      await expect(ownerPage.getByText("対戦相手を待っています")).toBeVisible();

      const invitationUrl = ownerPage.url();
      await opponentPage.goto(invitationUrl);
      await signInAsGuest(opponentPage, new URL(invitationUrl).pathname);
      await expect(
        opponentPage.getByRole("button", { name: "対策側で参加する" }),
      ).toBeVisible();
      await opponentPage
        .getByRole("button", { name: "対策側で参加する" })
        .click();

      await expect(ownerPage).toHaveURL(/\/games\/[A-Za-z0-9_-]+$/);
      await expect(opponentPage).toHaveURL(/\/games\/[A-Za-z0-9_-]+$/);
      const gameId = gameIdFromUrl(ownerPage.url());
      expect(gameId).toBe(gameIdFromUrl(opponentPage.url()));

      await expect(ownerPage.getByLabel("ゲーム進行")).toBeVisible();
      await expect(opponentPage.getByLabel("ゲーム進行")).toBeVisible();
      await expect(ownerPage.getByText("接続中")).toBeVisible();

      const stateVersionBeforePlacement = (await getSnapshot(ownerPage, gameId))
        .view.stateVersion;
      const placedCard = await placeAttackThroughHttp(
        ownerPage,
        opponentPage,
        gameId,
      );
      await expect
        .poll(
          async () => (await getSnapshot(ownerPage, gameId)).view.stateVersion,
        )
        .toBeGreaterThan(stateVersionBeforePlacement);
      await reloadBoard(placedCard.page, gameId);
      await expect(
        placedCard.page.getByLabel("自分の攻撃グループ"),
      ).toContainText(placedCard.cardName);

      const stateVersionBeforeSupport = (await getSnapshot(ownerPage, gameId))
        .view.stateVersion;
      await playSupportThroughHttp(ownerPage, opponentPage, gameId);
      await expect
        .poll(
          async () => (await getSnapshot(ownerPage, gameId)).view.stateVersion,
        )
        .toBeGreaterThan(stateVersionBeforeSupport);

      await opponentPage.close();
      await expect(
        ownerPage.getByLabel("相手のステータス").getByText("未接続"),
      ).toBeVisible();

      opponentPage = await opponentContext.newPage();
      await opponentPage.goto(`/games/${encodeURIComponent(gameId)}`);
      await expect(opponentPage.getByLabel("ゲーム進行")).toBeVisible();
      await expect(
        ownerPage.getByLabel("相手のステータス").getByText("接続中"),
      ).toBeVisible();

      await advanceToGameEnd(ownerPage, opponentPage, gameId);

      const finalSnapshot = await getSnapshot(ownerPage, gameId);
      expect(finalSnapshot.view.status).toBe("finished");
      expect(finalSnapshot.view.phase).toBe("finished");
      await expect(ownerPage.getByRole("dialog")).toBeVisible();
    } finally {
      await Promise.all([ownerContext.close(), opponentContext.close()]);
    }
  });
});

async function createGameContext(browser: Browser): Promise<BrowserContext> {
  return await browser.newContext({ viewport: { width: 1280, height: 900 } });
}

async function signInAsGuest(page: Page, returnTo: string): Promise<void> {
  await page.goto(returnTo);
  await page.getByRole("button", { name: "ゲストとして始める" }).click();
}

function gameIdFromUrl(url: string): string {
  const match = new URL(url).pathname.match(/^\/games\/([A-Za-z0-9_-]+)$/);
  if (match?.[1] === undefined) {
    throw new Error(`ゲームURLを取得できませんでした: ${url}`);
  }
  return match[1];
}

function pageForCurrentPlacementPlayer(
  snapshot: GameSnapshot,
  ownerPage: Page,
  opponentPage: Page,
): Page {
  const currentPlayerId =
    snapshot.view.phase === "firstPlayerPlacement"
      ? snapshot.view.firstPlayerId
      : snapshot.view.secondPlayerId;
  return snapshot.view.viewerPlayerId === currentPlayerId
    ? ownerPage
    : opponentPage;
}

async function placeAttackThroughHttp(
  ownerPage: Page,
  opponentPage: Page,
  gameId: string,
): Promise<{ page: Page; cardName: string }> {
  for (let step = 0; step < 80; step += 1) {
    const snapshot = await getSnapshot(ownerPage, gameId);
    if (snapshot.view.status === "finished") {
      break;
    }
    if (snapshot.view.phase === "support") {
      await finishSupportIfNeeded(ownerPage, gameId);
      await finishSupportIfNeeded(opponentPage, gameId);
      continue;
    }

    const currentPage = pageForCurrentPlacementPlayer(
      snapshot,
      ownerPage,
      opponentPage,
    );
    const currentSnapshot = await getSnapshot(currentPage, gameId);
    const catalog = await getCatalog(
      currentPage,
      currentSnapshot.view.cardCatalogVersion,
    );
    const attack = currentSnapshot.view.self.hand.find((card) => {
      const definition = catalog.definitions[card.definitionId];
      return (
        definition?.cardType === "attack" &&
        currentSnapshot.view.self.mana[definition.attribute].available >=
          (definition.cost ?? 0)
      );
    });
    if (attack === undefined) {
      await discardHandAndFinish(currentPage, gameId);
      continue;
    }

    const definition = catalog.definitions[attack.definitionId];
    if (definition === undefined) {
      throw new Error("攻撃カードの公開定義を取得できませんでした。");
    }
    await submitCommand(currentPage, {
      ...baseCommand(currentSnapshot, gameId),
      cardInstanceId: attack.instanceId,
      effectInputs: [],
      slotIndex: 0,
      type: "PLACE_ATTACK_CARD",
    });
    return { page: currentPage, cardName: definition.name };
  }

  throw new Error("配置可能な攻撃カードを取得できませんでした。");
}

async function playSupportThroughHttp(
  ownerPage: Page,
  opponentPage: Page,
  gameId: string,
): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    const snapshot = await getSnapshot(ownerPage, gameId);
    if (snapshot.view.status === "finished") {
      break;
    }
    if (
      snapshot.view.phase === "firstPlayerPlacement" ||
      snapshot.view.phase === "secondPlayerPlacement"
    ) {
      await keepPlayableSupportAndFinish(ownerPage, opponentPage, gameId);
      continue;
    }

    for (const page of [ownerPage, opponentPage]) {
      const pageSnapshot = await getSnapshot(page, gameId);
      const catalog = await getCatalog(
        page,
        pageSnapshot.view.cardCatalogVersion,
      );
      for (const card of pageSnapshot.view.self.hand) {
        const definition = catalog.definitions[card.definitionId];
        if (
          definition?.cardType !== "support" ||
          pageSnapshot.view.self.mana[definition.attribute].available <
            (definition.cost ?? 0)
        ) {
          continue;
        }
        const effectInputs = createEffectInputs(
          definition,
          card.instanceId,
          pageSnapshot.view,
        );
        if (effectInputs === null) {
          continue;
        }
        await submitCommand(page, {
          ...baseCommand(pageSnapshot, gameId),
          cardInstanceId: card.instanceId,
          effectInputs,
          type: "PLAY_SUPPORT_CARD",
        });
        return;
      }
    }

    await finishSupportIfNeeded(ownerPage, gameId);
    await finishSupportIfNeeded(opponentPage, gameId);
  }

  throw new Error("使用可能なサポートカードを取得できませんでした。");
}

async function keepPlayableSupportAndFinish(
  ownerPage: Page,
  opponentPage: Page,
  gameId: string,
): Promise<void> {
  const ownerSnapshot = await getSnapshot(ownerPage, gameId);
  const currentPage = pageForCurrentPlacementPlayer(
    ownerSnapshot,
    ownerPage,
    opponentPage,
  );
  let currentSnapshot = await getSnapshot(currentPage, gameId);
  const catalog = await getCatalog(
    currentPage,
    currentSnapshot.view.cardCatalogVersion,
  );
  const playableSupport = currentSnapshot.view.self.hand.find((card) => {
    const definition = catalog.definitions[card.definitionId];
    return (
      definition?.cardType === "support" &&
      currentSnapshot.view.self.mana[definition.attribute].available >=
        (definition.cost ?? 0) &&
      createEffectInputs(definition, card.instanceId, currentSnapshot.view) !==
        null
    );
  });

  for (const card of currentSnapshot.view.self.hand) {
    if (card.instanceId === playableSupport?.instanceId) {
      continue;
    }
    await submitCommand(currentPage, {
      ...baseCommand(currentSnapshot, gameId),
      cardInstanceId: card.instanceId,
      type: "DISCARD_HAND_CARD",
    });
    currentSnapshot = await getSnapshot(currentPage, gameId);
  }

  await submitFinish(currentPage, gameId);
}

function createEffectInputs(
  definition: PublicCardCatalog["definitions"][string],
  sourceCardInstanceId: string,
  view: GameSnapshot["view"],
): EffectInput[] | null {
  const effectInputs: EffectInput[] = [];
  for (const effect of definition.interaction.effects) {
    const candidates = getEffectTargets(
      effect.target,
      sourceCardInstanceId,
      view,
    );
    if (candidates.length < effect.target.minTargets) {
      return null;
    }
    effectInputs.push({
      effectId: effect.effectId,
      targets: candidates.slice(0, effect.target.minTargets),
    });
  }
  return effectInputs;
}

function getEffectTargets(
  target: PublicCardCatalog["definitions"][string]["interaction"]["effects"][number]["target"],
  sourceCardInstanceId: string,
  view: GameSnapshot["view"],
): EffectTarget[] {
  const players =
    target.side === "self"
      ? [view.self]
      : target.side === "opponent"
        ? [view.opponent]
        : [view.self, view.opponent];
  const targets: EffectTarget[] = [];
  for (const zone of target.zones) {
    for (const player of players) {
      if (zone === "attackGroup") {
        targets.push(
          ...player.attackGroups.map((group) => ({
            type: "attackGroup" as const,
            groupId: group.groupId,
          })),
        );
      }
      if (zone === "attackCard") {
        targets.push(
          ...player.attackGroups.flatMap((group) =>
            group.cards.map((card) => ({
              type: "attackCard" as const,
              cardInstanceId: card.instanceId,
            })),
          ),
        );
      }
      if (zone === "supportCard") {
        targets.push(
          ...player.supportZone.map((card) => ({
            type: "supportCard" as const,
            cardInstanceId: card.instanceId,
          })),
        );
      }
      if (zone === "player") {
        targets.push({ type: "player", playerId: player.playerId });
      }
      if (zone === "mana") {
        targets.push(
          ...(["attributeA", "attributeB", "attributeC"] as const).map(
            (attribute) => ({
              type: "mana" as const,
              playerId: player.playerId,
              attribute,
            }),
          ),
        );
      }
    }
  }
  if (
    target.allowSourceCard &&
    target.side !== "opponent" &&
    target.zones.includes("supportCard")
  ) {
    targets.push({ type: "supportCard", cardInstanceId: sourceCardInstanceId });
  }
  return targets;
}

async function getCatalog(
  page: Page,
  version: string,
): Promise<PublicCardCatalog> {
  return await page.evaluate(async (catalogVersion) => {
    const response = await fetch(
      `/api/card-catalogs/${encodeURIComponent(catalogVersion)}`,
    );
    if (!response.ok) {
      throw new Error(`カードカタログ取得に失敗しました: ${response.status}`);
    }
    return ((await response.json()) as { catalog: PublicCardCatalog }).catalog;
  }, version);
}

async function reloadBoard(page: Page, gameId: string): Promise<void> {
  await page.goto(`/games/${encodeURIComponent(gameId)}`);
  await expect(page.getByLabel("ゲーム進行")).toBeVisible();
}

async function advanceToGameEnd(
  ownerPage: Page,
  opponentPage: Page,
  gameId: string,
): Promise<void> {
  for (let step = 0; step < 160; step += 1) {
    const ownerSnapshot = await getSnapshot(ownerPage, gameId);
    if (ownerSnapshot.view.status === "finished") {
      return;
    }

    if (
      ownerSnapshot.view.phase === "firstPlayerPlacement" ||
      ownerSnapshot.view.phase === "secondPlayerPlacement"
    ) {
      const currentPage = pageForCurrentPlacementPlayer(
        ownerSnapshot,
        ownerPage,
        opponentPage,
      );
      await discardHandAndFinish(currentPage, gameId);
      continue;
    }

    await finishSupportIfNeeded(ownerPage, gameId);
    await finishSupportIfNeeded(opponentPage, gameId);
  }

  throw new Error("規定回数内にゲームが終了しませんでした。");
}

async function discardHandAndFinish(page: Page, gameId: string): Promise<void> {
  let snapshot = await getSnapshot(page, gameId);
  for (const card of snapshot.view.self.hand) {
    await submitCommand(page, {
      ...baseCommand(snapshot, gameId),
      cardInstanceId: card.instanceId,
      type: "DISCARD_HAND_CARD",
    });
    snapshot = await getSnapshot(page, gameId);
  }
  await submitFinish(page, gameId);
}

async function finishSupportIfNeeded(
  page: Page,
  gameId: string,
): Promise<void> {
  const snapshot = await getSnapshot(page, gameId);
  if (
    snapshot.view.status === "active" &&
    snapshot.view.phase === "support" &&
    !snapshot.view.self.supportFinished
  ) {
    await submitFinish(page, gameId);
  }
}

async function submitFinish(page: Page, gameId: string): Promise<void> {
  const snapshot = await getSnapshot(page, gameId);
  const type =
    snapshot.view.phase === "support" ? "FINISH_SUPPORT" : "FINISH_PLACEMENT";
  await submitCommand(page, { ...baseCommand(snapshot, gameId), type });
}

let commandSequence = 0;

function baseCommand(
  snapshot: GameSnapshot,
  gameId: string,
): Omit<Command, "type"> {
  commandSequence += 1;
  return {
    commandId: `playwright-e2e-${commandSequence}`,
    gameId,
    playerId: snapshot.view.viewerPlayerId,
    phaseSequence: snapshot.view.phaseSequence,
    clientStateVersion: snapshot.view.stateVersion,
    issuedAt: Date.now(),
  };
}

async function getSnapshot(page: Page, gameId: string): Promise<GameSnapshot> {
  return await page.evaluate(async (id) => {
    const response = await fetch(`/api/games/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(`スナップショット取得に失敗しました: ${response.status}`);
    }
    return (await response.json()) as GameSnapshot;
  }, gameId);
}

async function submitCommand(page: Page, command: Command): Promise<void> {
  const result = await page.evaluate(async (submittedCommand) => {
    const response = await fetch(
      `/api/games/${encodeURIComponent(submittedCommand.gameId)}/commands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: submittedCommand }),
      },
    );
    return {
      status: response.status,
      body: (await response.json()) as { accepted?: boolean },
    };
  }, command);

  expect(result.status).toBe(200);
  expect(result.body.accepted).toBe(true);
}
