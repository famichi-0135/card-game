import {
  DragDropProvider,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  ATTACK_GROUP_SLOT_INDICES,
  getAvailableGameActions,
  type Attribute,
  type AttackGroupSlotIndex,
  type PublicCardCatalog,
  type VisibleAttackGroup,
  type VisibleCardInstance,
} from "@disastar/game-engine";
import { useEffect, useMemo, useState } from "react";
import type { GameBoardFixture } from "./game-board-fixture.ts";

const attributes: readonly Attribute[] = [
  "attributeA",
  "attributeB",
  "attributeC",
];

const attributeLabels: Record<Attribute, string> = {
  attributeA: "属性A",
  attributeB: "属性B",
  attributeC: "属性C",
};

const phaseLabels: Record<GameBoardFixture["view"]["phase"], string> = {
  initializing: "準備中",
  firstPlayerPlacement: "あなたの配置",
  secondPlayerPlacement: "相手の配置",
  support: "サポート",
  resolution: "解決",
  cleanup: "整理",
  refill: "補充",
  finished: "終了",
};

type BoardPlayer =
  | GameBoardFixture["view"]["self"]
  | GameBoardFixture["view"]["opponent"];

type ZoneDialogState = {
  cards: readonly VisibleCardInstance[];
  description: string;
  title: string;
};

type LocalBoardState = {
  attackGroups: VisibleAttackGroup[];
  hand: VisibleCardInstance[];
};

export function GameBoard({ fixture }: { fixture: GameBoardFixture }) {
  const { catalog, view } = fixture;
  const [boardState, setBoardState] = useState<LocalBoardState>(() => ({
    attackGroups: [...view.self.attackGroups],
    hand: [...view.self.hand],
  }));
  const [zoneDialog, setZoneDialog] = useState<ZoneDialogState | null>(null);
  const currentView = useMemo(
    () => ({
      ...view,
      self: {
        ...view.self,
        attackGroups: boardState.attackGroups,
        hand: boardState.hand,
        handCount: boardState.hand.length,
      },
    }),
    [boardState, view],
  );
  const availableActions = useMemo(
    () =>
      getAvailableGameActions({ view: currentView, catalog, now: Date.now() }),
    [catalog, currentView],
  );
  const remainingSeconds = useRemainingSeconds(view.phaseDeadlineAt);

  const handleDragEnd = ({ canceled, operation }: DragEndEvent) => {
    const cardInstanceId = operation.source?.data.cardInstanceId as
      | string
      | undefined;
    const slotIndex = operation.target?.data.slotIndex as number | undefined;
    const targetSide = operation.target?.data.side as string | undefined;

    if (
      canceled ||
      cardInstanceId === undefined ||
      slotIndex === undefined ||
      targetSide !== "self" ||
      !isAttackGroupSlotIndex(slotIndex)
    ) {
      return;
    }

    const actions = availableActions.handCards[cardInstanceId];
    if (
      actions === undefined ||
      !actions.placeAttack.available ||
      !actions.placeAttack.slotIndices.includes(slotIndex)
    ) {
      return;
    }

    setBoardState((current) => {
      if (current.attackGroups.some((group) => group.slotIndex === slotIndex)) {
        return current;
      }

      const card = current.hand.find(
        (candidate) => candidate.instanceId === cardInstanceId,
      );
      if (card === undefined) {
        return current;
      }

      const definition = catalog.definitions[card.definitionId];
      if (definition === undefined || definition.cardType !== "attack") {
        return current;
      }

      return {
        hand: current.hand.filter(
          (candidate) => candidate.instanceId !== cardInstanceId,
        ),
        attackGroups: [
          ...current.attackGroups,
          {
            groupId: `preview-group-${slotIndex}-${card.instanceId}`,
            ownerId: view.self.playerId,
            slotIndex,
            attribute: definition.attribute,
            createdRound: view.round,
            cards: [card],
            requiredMana: definition.cost ?? 0,
            currentPower: definition.basePower ?? 0,
          },
        ],
      };
    });
  };

  return (
    <>
      <DragDropProvider onDragEnd={handleDragEnd}>
        <main className="h-dvh min-w-[1140px] overflow-hidden bg-slate-100 p-4 max-[1179px]:hidden max-[719px]:hidden">
          <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
            <OpponentZone
              deckCount={view.opponent.deckCount}
              discardCount={view.opponent.discardPile.length}
              gameId={view.gameId}
              handCount={view.opponent.handCount}
              stateVersion={view.stateVersion}
              onOpenDiscard={() =>
                setZoneDialog({
                  title: "相手の捨て札",
                  description: "公開済みのカード",
                  cards: view.opponent.discardPile,
                })
              }
            />

            <section
              className="grid min-h-0 grid-cols-[210px_minmax(0,1fr)_210px] gap-3 rounded-md border border-slate-300 bg-white p-3"
              aria-label="バトルゾーン"
            >
              <PlayerSummary
                player={view.opponent}
                label="相手"
                onOpenDiscard={() =>
                  setZoneDialog({
                    title: "相手の捨て札",
                    description: "公開済みのカード",
                    cards: view.opponent.discardPile,
                  })
                }
              />

              <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3">
                <AttackGroupRow
                  catalog={catalog}
                  groups={view.opponent.attackGroups}
                  label="相手の攻撃グループ"
                  perspective="opponent"
                />

                <section className="flex items-center justify-between gap-4 rounded-md border border-slate-300 px-4 py-3 text-sm">
                  <div>
                    <span className="text-slate-500">ROUND </span>
                    <strong>{view.round}</strong>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">現在のフェーズ</span>
                    <strong>{phaseLabels[view.phase]}</strong>
                    <span className="rounded border border-slate-300 px-2 py-1 font-mono text-xs">
                      {formatSeconds(remainingSeconds)}
                    </span>
                  </div>
                  <span className="truncate text-slate-600">
                    配置フェーズが開始されました
                  </span>
                </section>

                <AttackGroupRow
                  catalog={catalog}
                  groups={boardState.attackGroups}
                  label="自分の攻撃グループ"
                  perspective="self"
                  availableActions={availableActions}
                  onOpenGroup={(group) =>
                    setZoneDialog({
                      title: `自分の攻撃グループ ${group.slotIndex + 1}`,
                      description: `必要みなもと ${group.requiredMana} / 攻撃力 ${group.currentPower}`,
                      cards: group.cards,
                    })
                  }
                />
              </section>

              <ManaPanel player={view.self} />
            </section>

            <section className="grid grid-cols-[210px_minmax(0,1fr)_210px] gap-3 rounded-md border border-slate-300 bg-white p-3">
              <section
                className="grid grid-cols-2 gap-2"
                aria-label="自分のカードゾーン"
              >
                <ZoneButton
                  label="捨て札"
                  count={view.self.discardPile.length}
                  onClick={() =>
                    setZoneDialog({
                      title: "自分の捨て札",
                      description: "このゲームで使用または破棄したカード",
                      cards: view.self.discardPile,
                    })
                  }
                />
                <ZoneButton
                  label="サポート"
                  count={view.self.supportZone.length}
                  onClick={() =>
                    setZoneDialog({
                      title: "自分のサポートグループ",
                      description: "現在場に出ているサポートカード",
                      cards: view.self.supportZone,
                    })
                  }
                />
              </section>

              <section aria-label="自分の手札">
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">HAND</p>
                    <h1 className="text-base font-semibold">
                      手札 {boardState.hand.length} 枚
                    </h1>
                  </div>
                  <span className="text-xs text-slate-500">
                    ドラッグして配置
                  </span>
                </div>
                <div className="flex min-h-[148px] items-end justify-center gap-3">
                  {boardState.hand.map((card) => (
                    <DraggableHandCard
                      key={card.instanceId}
                      card={card}
                      catalog={catalog}
                      actions={availableActions.handCards[card.instanceId]}
                    />
                  ))}
                </div>
              </section>

              <section
                className="flex items-center justify-center"
                aria-label="自分の山札"
              >
                <div className="w-full rounded-md border border-slate-300 p-3 text-center text-sm">
                  <p className="text-slate-500">山札</p>
                  <strong className="text-lg">{view.self.deckCount}</strong>
                </div>
              </section>
            </section>
          </div>
        </main>
      </DragDropProvider>

      <DesktopOnlyNotice />
      {zoneDialog === null ? null : (
        <ZoneDialog
          catalog={catalog}
          state={zoneDialog}
          onClose={() => setZoneDialog(null)}
        />
      )}
    </>
  );
}

function OpponentZone({
  deckCount,
  discardCount,
  gameId,
  handCount,
  stateVersion,
  onOpenDiscard,
}: {
  deckCount: number;
  discardCount: number;
  gameId: string;
  handCount: number;
  stateVersion: number;
  onOpenDiscard: () => void;
}) {
  return (
    <header className="grid grid-cols-[210px_minmax(0,1fr)_210px] items-start gap-3">
      <div className="rounded-b-md border border-slate-300 bg-white px-3 py-2 text-sm">
        <p className="text-slate-500">相手の山札</p>
        <strong>{deckCount} 枚</strong>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-center">
          <p className="text-lg font-semibold tracking-wide">DISASTAR</p>
          <p className="text-xs text-slate-500">
            対戦 ID: {gameId} / 状態 v{stateVersion}
          </p>
        </div>
        <div
          className="flex justify-center gap-2"
          aria-label={`相手の手札 ${handCount} 枚`}
        >
          {Array.from({ length: handCount }, (_, index) => (
            <span
              className="h-10 w-7 rounded-b border border-slate-300 bg-white"
              key={index}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <button
        className="rounded-b-md border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        onClick={onOpenDiscard}
        type="button"
      >
        <span className="block text-slate-500">相手の捨て札</span>
        <strong>{discardCount} 枚</strong>
      </button>
    </header>
  );
}

function PlayerSummary({
  player,
  label,
  onOpenDiscard,
}: {
  player: BoardPlayer;
  label: string;
  onOpenDiscard: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col justify-between rounded-md border border-slate-300 p-3">
      <div>
        <p className="text-xs font-medium text-slate-500">PLAYER</p>
        <h2 className="mt-1 text-lg font-semibold">{label}</h2>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="text-xs text-slate-500">スタミナ</dt>
          <dd className="font-semibold">{player.stamina}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">山札</dt>
          <dd className="font-semibold">{player.deckCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">手札</dt>
          <dd className="font-semibold">{player.handCount}</dd>
        </div>
      </dl>
      <button
        className="rounded border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        onClick={onOpenDiscard}
        type="button"
      >
        捨て札 {player.discardPile.length} 枚
      </button>
    </aside>
  );
}

function ManaPanel({ player }: { player: GameBoardFixture["view"]["self"] }) {
  return (
    <aside className="rounded-md border border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-500">MANA</p>
      <dl className="mt-3 grid gap-3">
        {attributes.map((attribute) => {
          const mana = player.mana[attribute];
          return (
            <div
              className="flex items-center justify-between gap-3"
              key={attribute}
            >
              <div>
                <dt className="text-sm">{attributeLabels[attribute]}</dt>
                <dd className="text-xs text-slate-500">
                  使用可 / {mana.total}
                </dd>
              </div>
              <strong className="rounded border border-slate-300 px-2 py-1 font-mono text-sm">
                {mana.available}
              </strong>
            </div>
          );
        })}
      </dl>
    </aside>
  );
}

function AttackGroupRow({
  catalog,
  groups,
  label,
  perspective,
  availableActions,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  groups: readonly VisibleAttackGroup[];
  label: string;
  perspective: "self" | "opponent";
  availableActions?: GameBoardFixture["availableActions"];
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  return (
    <section
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2"
      aria-label={label}
    >
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-slate-500">{groups.length} / 5</span>
      </div>
      <div className="grid min-h-0 grid-cols-5 gap-3">
        {ATTACK_GROUP_SLOT_INDICES.map((slotIndex) => {
          const group = groups.find(
            (candidate) => candidate.slotIndex === slotIndex,
          );
          const canPlace =
            perspective === "self" &&
            hasPlacementCandidate(availableActions, slotIndex) &&
            group === undefined;
          return (
            <AttackGroupSlot
              key={slotIndex}
              catalog={catalog}
              group={group}
              slotIndex={slotIndex}
              canPlace={canPlace}
              isSelf={perspective === "self"}
              onOpenGroup={onOpenGroup}
            />
          );
        })}
      </div>
    </section>
  );
}

function AttackGroupSlot({
  catalog,
  group,
  slotIndex,
  canPlace,
  isSelf,
  onOpenGroup,
}: {
  catalog: PublicCardCatalog;
  group: VisibleAttackGroup | undefined;
  slotIndex: AttackGroupSlotIndex;
  canPlace: boolean;
  isSelf: boolean;
  onOpenGroup?: (group: VisibleAttackGroup) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `attack-slot-${slotIndex}`,
    type: "attack-slot",
    accept: "hand-card",
    disabled: !canPlace,
    data: { slotIndex, side: isSelf ? "self" : "opponent" },
  });

  const content =
    group === undefined ? (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        {canPlace ? "ここへ配置" : "空き枠"}
      </div>
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-2 pt-4 text-left">
        <div className="flex items-center justify-center">
          {group.cards.slice(-3).map((card, index) => (
            <CompactCard
              key={card.instanceId}
              card={card}
              catalog={catalog}
              stacked={index > 0}
            />
          ))}
        </div>
        <span className="text-center text-xs text-slate-600">
          {group.cards.length} 枚 / 力 {group.currentPower}
        </span>
      </div>
    );

  return (
    <div
      ref={ref}
      className={`relative min-h-0 rounded-md border p-2 ${
        isDropTarget
          ? "border-slate-900 bg-slate-100"
          : canPlace
            ? "border-dashed border-slate-500 bg-white"
            : "border-slate-300 bg-slate-50"
      }`}
    >
      <span className="absolute left-2 top-1 text-[10px] text-slate-400">
        {String(slotIndex + 1).padStart(2, "0")}
      </span>
      {group !== undefined && onOpenGroup !== undefined ? (
        <button
          className="h-full w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={() => onOpenGroup(group)}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

function CompactCard({
  card,
  catalog,
  stacked,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  stacked: boolean;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <span
      className={`flex h-16 w-12 shrink-0 flex-col justify-between rounded border border-slate-300 bg-white p-1 text-[9px] ${
        stacked ? "-ml-4 translate-y-1" : ""
      }`}
    >
      <span>{cardTypeMark(definition.cardType)}</span>
      <strong className="line-clamp-2 leading-tight">{definition.name}</strong>
    </span>
  );
}

function DraggableHandCard({
  card,
  catalog,
  actions,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  actions:
    | GameBoardFixture["availableActions"]["handCards"][string]
    | undefined;
}) {
  const definition = catalog.definitions[card.definitionId];
  const canDrag = actions?.placeAttack.available === true;
  const { ref, isDragging } = useDraggable({
    id: `hand-card-${card.instanceId}`,
    type: "hand-card",
    disabled: !canDrag,
    data: { cardInstanceId: card.instanceId },
  });

  if (definition === undefined) {
    return null;
  }

  return (
    <div className="group relative">
      <button
        ref={ref}
        className={`grid h-36 w-28 grid-rows-[auto_1fr_auto_auto] rounded-md border bg-white p-2 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          isDragging ? "opacity-40" : "opacity-100"
        } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
          canDrag ? "border-slate-400" : "border-slate-300"
        }`}
        type="button"
        aria-label={`${definition.name}。${getActionSummary(actions)}`}
      >
        <span className="text-[10px] text-slate-500">
          {cardTypeLabel(definition.cardType)} /{" "}
          {attributeLabels[definition.attribute]}
        </span>
        <span
          className="flex items-center justify-center text-3xl"
          aria-hidden="true"
        >
          {cardTypeMark(definition.cardType)}
        </span>
        <strong className="text-sm leading-tight">{definition.name}</strong>
        <span className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-[10px] text-slate-600">
          <span>コスト {definition.cost ?? "-"}</span>
          <span>力 {definition.basePower ?? "-"}</span>
        </span>
      </button>

      <CardHoverPreview definition={definition} />
    </div>
  );
}

function CardHoverPreview({
  definition,
}: {
  definition: NonNullable<PublicCardCatalog["definitions"][string]>;
}) {
  return (
    <section
      className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-64 -translate-x-1/2 rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm group-hover:block group-focus-within:block"
      role="tooltip"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {cardTypeLabel(definition.cardType)} /{" "}
            {attributeLabels[definition.attribute]}
          </p>
          <strong>{definition.name}</strong>
        </div>
        <span className="text-2xl" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <dl className="mt-3 flex gap-4 text-xs">
        <div>
          <dt className="text-slate-500">コスト</dt>
          <dd className="font-semibold">{definition.cost ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">攻撃力</dt>
          <dd className="font-semibold">{definition.basePower ?? "-"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {definition.rulesText}
      </p>
    </section>
  );
}

function ZoneButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-md border border-slate-300 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      onClick={onClick}
      type="button"
    >
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="text-lg">{count}</strong>
      <span className="ml-1 text-xs">枚</span>
    </button>
  );
}

function ZoneDialog({
  catalog,
  state,
  onClose,
}: {
  catalog: PublicCardCatalog;
  state: ZoneDialogState;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-6"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby="zone-dialog-title"
        className="max-h-[70dvh] w-full max-w-2xl overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold" id="zone-dialog-title">
              {state.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{state.description}</p>
          </div>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onClose}
            type="button"
          >
            閉じる
          </button>
        </header>
        <div className="max-h-[calc(70dvh-88px)] overflow-y-auto p-4">
          {state.cards.length === 0 ? (
            <p className="text-sm text-slate-500">カードはありません。</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3">
              {state.cards.map((card) => (
                <li key={card.instanceId}>
                  <ZoneCard card={card} catalog={catalog} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function ZoneCard({
  card,
  catalog,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <article className="rounded-md border border-slate-300 p-3">
      <div className="flex items-center justify-between gap-3">
        <strong>{definition.name}</strong>
        <span className="text-lg" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {cardTypeLabel(definition.cardType)} /{" "}
        {attributeLabels[definition.attribute]}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        {definition.rulesText}
      </p>
    </article>
  );
}

function DesktopOnlyNotice() {
  return (
    <main className="hidden min-h-dvh items-center justify-center bg-slate-100 p-6 text-center max-[1179px]:flex max-[719px]:flex">
      <div className="rounded-md border border-slate-300 bg-white p-6">
        <p className="text-xs font-medium text-slate-500">DISASTAR CARD GAME</p>
        <h1 className="mt-2 text-xl font-semibold">
          PC 横画面で開いてください
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          対戦画面は幅 1180px、高さ 720px 以上に対応しています。
        </p>
      </div>
    </main>
  );
}

function hasPlacementCandidate(
  availableActions: GameBoardFixture["availableActions"] | undefined,
  slotIndex: AttackGroupSlotIndex,
): boolean {
  if (availableActions === undefined) {
    return false;
  }
  return Object.values(availableActions.handCards).some(
    (actions) =>
      actions.placeAttack.available &&
      actions.placeAttack.slotIndices.includes(slotIndex),
  );
}

function isAttackGroupSlotIndex(value: number): value is AttackGroupSlotIndex {
  return ATTACK_GROUP_SLOT_INDICES.includes(value as AttackGroupSlotIndex);
}

function getActionSummary(
  actions:
    | GameBoardFixture["availableActions"]["handCards"][string]
    | undefined,
): string {
  if (actions === undefined) {
    return "操作候補を確認できません";
  }
  if (actions.placeAttack.available || actions.chainAttack.available) {
    return "攻撃操作の候補があります";
  }
  if (actions.playSupport.available) {
    return "サポート操作の候補があります";
  }
  if (actions.discard.available) {
    return "破棄できます";
  }
  return "このフェーズでは操作できません";
}

function useRemainingSeconds(deadlineAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return deadlineAt === null
    ? 0
    : Math.max(0, Math.ceil((deadlineAt - now) / 1_000));
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function cardTypeLabel(cardType: "mana" | "attack" | "support"): string {
  switch (cardType) {
    case "mana":
      return "みなもと";
    case "attack":
      return "攻撃";
    case "support":
      return "サポート";
  }
}

function cardTypeMark(cardType: "mana" | "attack" | "support"): string {
  switch (cardType) {
    case "mana":
      return "M";
    case "attack":
      return "A";
    case "support":
      return "S";
  }
}
