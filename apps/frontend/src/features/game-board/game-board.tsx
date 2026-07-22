import { DragDropProvider } from "@dnd-kit/react";
import {
  ATTACK_GROUP_SLOT_INDICES,
  type Attribute,
  type AttackGroupSlotIndex,
  type PublicCardCatalog,
  type VisibleAttackGroup,
  type VisibleCardInstance,
} from "@disastar/game-engine";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { GameBoardFixture } from "./game-board-fixture.ts";
import "./game-board.css";

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

export function GameBoard({ fixture }: { fixture: GameBoardFixture }) {
  const { catalog, view, availableActions } = fixture;
  const [selectedCardId, setSelectedCardId] = useState(
    view.self.hand[0]?.instanceId ?? null,
  );
  const remainingSeconds = useRemainingSeconds(view.phaseDeadlineAt);
  const selectedCard = findSelectedCard(view, selectedCardId);
  const selectedDefinition =
    selectedCard === undefined
      ? undefined
      : catalog.definitions[selectedCard.definitionId];

  return (
    <>
      <main className="game-board-shell">
        <DragDropProvider>
          <section className="game-board" aria-label="対戦盤面">
            <header className="game-board__header">
              <Link className="game-board__brand" to="/">
                DISASTAR
              </Link>
              <div className="game-board__match-meta">
                <span>対戦 ID: {view.gameId}</span>
                <span>状態 v{view.stateVersion}</span>
              </div>
            </header>

            <PlayerArea
              catalog={catalog}
              player={view.opponent}
              groups={view.opponent.attackGroups}
              label="対策側"
              perspective="opponent"
              selectedCardId={selectedCardId}
              onSelectCard={setSelectedCardId}
            />

            <section className="game-board__center" aria-label="対戦進行">
              <div className="round-marker">
                <span>ROUND</span>
                <strong>{view.round}</strong>
              </div>
              <div className="phase-status">
                <span className="phase-status__label">現在のフェーズ</span>
                <strong>{phaseLabels[view.phase]}</strong>
                <span className="phase-status__time">
                  残り {formatSeconds(remainingSeconds)}
                </span>
              </div>
              <div className="event-feed" aria-label="公開イベント">
                <span className="event-feed__label">公開イベント</span>
                <p>配置フェーズが開始されました</p>
              </div>
            </section>

            <PlayerArea
              catalog={catalog}
              player={view.self}
              groups={view.self.attackGroups}
              label="災害側"
              perspective="self"
              availableActions={availableActions}
              selectedCardId={selectedCardId}
              onSelectCard={setSelectedCardId}
            />

            <section
              className="game-board__hand-area"
              aria-label="あなたの手札"
            >
              <div className="hand-area__header">
                <div>
                  <span className="section-label">HAND</span>
                  <strong>手札 {view.self.handCount} 枚</strong>
                </div>
                <p>
                  操作候補はゲームエンジンで判定済みです。コマンド送信は次の実装で追加します。
                </p>
                {selectedDefinition === undefined ? null : (
                  <div className="hand-area__compact-detail" aria-live="polite">
                    <strong>{selectedDefinition.name}</strong>
                    <span>
                      {cardTypeLabel(selectedDefinition.cardType)} / コスト{" "}
                      {selectedDefinition.cost ?? "-"} / 力{" "}
                      {selectedDefinition.basePower ?? "-"}
                    </span>
                    <p>{selectedDefinition.rulesText}</p>
                  </div>
                )}
              </div>
              <div className="hand-area__cards">
                {view.self.hand.map((card) => {
                  const actions = availableActions.handCards[card.instanceId];
                  return (
                    <CardFace
                      key={card.instanceId}
                      card={card}
                      catalog={catalog}
                      selected={selectedCardId === card.instanceId}
                      actionSummary={getActionSummary(actions)}
                      onSelect={setSelectedCardId}
                    />
                  );
                })}
              </div>
            </section>

            <aside className="game-board__detail" aria-live="polite">
              <span className="section-label">CARD DETAIL</span>
              {selectedCard === undefined ||
              selectedDefinition === undefined ? (
                <p>手札または盤面のカードを選択すると詳細を表示します。</p>
              ) : (
                <CardDetail definition={selectedDefinition} />
              )}
            </aside>
          </section>
        </DragDropProvider>
      </main>

      <DesktopOnlyNotice />
    </>
  );
}

function PlayerArea({
  catalog,
  player,
  groups,
  label,
  perspective,
  availableActions,
  selectedCardId,
  onSelectCard,
}: {
  catalog: PublicCardCatalog;
  player: BoardPlayer;
  groups: readonly VisibleAttackGroup[];
  label: string;
  perspective: "self" | "opponent";
  availableActions?: GameBoardFixture["availableActions"];
  selectedCardId: string | null;
  onSelectCard: (cardInstanceId: string) => void;
}) {
  const isSelf = perspective === "self";

  return (
    <section className={`player-area player-area--${perspective}`}>
      <div className="player-area__identity">
        <div>
          <span className="section-label">{isSelf ? "YOU" : "OPPONENT"}</span>
          <h2>{label}</h2>
        </div>
        <dl className="player-stats">
          <div>
            <dt>スタミナ</dt>
            <dd>{player.stamina}</dd>
          </div>
          <div>
            <dt>山札</dt>
            <dd>{player.deckCount}</dd>
          </div>
          <div>
            <dt>捨て札</dt>
            <dd>{player.discardPile.length}</dd>
          </div>
        </dl>
        {isSelf ? null : (
          <p className="hidden-hand-count">手札 {player.handCount} 枚</p>
        )}
      </div>

      <div className="player-area__field">
        <div className="field-header">
          <span>攻撃グループ</span>
          <span>{groups.length} / 5</span>
        </div>
        <div className="attack-slots">
          {ATTACK_GROUP_SLOT_INDICES.map((slotIndex) => {
            const group = groups.find((group) => group.slotIndex === slotIndex);
            const isAvailable =
              isSelf && hasPlacementCandidate(availableActions, slotIndex);
            return (
              <AttackGroupSlot
                key={slotIndex}
                catalog={catalog}
                group={group}
                slotIndex={slotIndex}
                isAvailable={isAvailable}
                selectedCardId={selectedCardId}
                onSelectCard={onSelectCard}
              />
            );
          })}
        </div>
      </div>

      <div className="player-area__resources">
        <span className="section-label">MANA</span>
        <div className="mana-list">
          {attributes.map((attribute) => {
            const mana = player.mana[attribute];
            return (
              <div
                key={attribute}
                className={`mana-row mana-row--${attribute}`}
              >
                <span>{attributeLabels[attribute]}</span>
                <strong>{mana.available}</strong>
                <small>使用可 / {mana.total}</small>
              </div>
            );
          })}
        </div>
        <div className="support-zone">
          <span>サポート</span>
          <strong>{player.supportZone.length} 枚</strong>
        </div>
      </div>
    </section>
  );
}

function AttackGroupSlot({
  catalog,
  group,
  slotIndex,
  isAvailable,
  selectedCardId,
  onSelectCard,
}: {
  catalog: PublicCardCatalog;
  group: VisibleAttackGroup | undefined;
  slotIndex: AttackGroupSlotIndex;
  isAvailable: boolean;
  selectedCardId: string | null;
  onSelectCard: (cardInstanceId: string) => void;
}) {
  if (group === undefined) {
    return (
      <div
        className={`attack-slot${isAvailable ? " attack-slot--available" : ""}`}
        aria-label={`攻撃グループ枠 ${slotIndex + 1}${isAvailable ? "、配置候補あり" : "、空"}`}
      >
        <span className="attack-slot__number">
          {String(slotIndex + 1).padStart(2, "0")}
        </span>
        <span className="attack-slot__empty">空き枠</span>
      </div>
    );
  }

  return (
    <div className="attack-slot attack-slot--occupied">
      <span className="attack-slot__number">
        {String(slotIndex + 1).padStart(2, "0")}
      </span>
      <div className="attack-slot__stack">
        {group.cards.slice(-3).map((card) => (
          <CompactCard
            key={card.instanceId}
            card={card}
            catalog={catalog}
            selected={selectedCardId === card.instanceId}
            onSelect={onSelectCard}
          />
        ))}
      </div>
      <div className="attack-slot__summary">
        <span>{group.cards.length} 枚</span>
        <strong>力 {group.currentPower}</strong>
        <small>必要 {group.requiredMana}</small>
      </div>
    </div>
  );
}

function CompactCard({
  card,
  catalog,
  selected,
  onSelect,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  selected: boolean;
  onSelect: (cardInstanceId: string) => void;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <button
      className={`compact-card compact-card--${definition.attribute}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(card.instanceId)}
      onFocus={() => onSelect(card.instanceId)}
    >
      <span>{cardTypeMark(definition.cardType)}</span>
      <strong>{definition.name}</strong>
    </button>
  );
}

function CardFace({
  card,
  catalog,
  selected,
  actionSummary,
  onSelect,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  selected: boolean;
  actionSummary: string;
  onSelect: (cardInstanceId: string) => void;
}) {
  const definition = catalog.definitions[card.definitionId];
  if (definition === undefined) {
    return null;
  }

  return (
    <button
      className={`card-face card-face--${definition.attribute}${selected ? " card-face--selected" : ""}`}
      type="button"
      aria-pressed={selected}
      aria-label={`${definition.name}。${actionSummary}`}
      onClick={() => onSelect(card.instanceId)}
      onFocus={() => onSelect(card.instanceId)}
      onMouseEnter={() => onSelect(card.instanceId)}
    >
      <span className="card-face__type">
        {cardTypeLabel(definition.cardType)}
      </span>
      <span className="card-face__art" aria-hidden="true">
        {cardTypeMark(definition.cardType)}
      </span>
      <span className="card-face__attribute">
        {attributeLabels[definition.attribute]}
      </span>
      <strong className="card-face__name">{definition.name}</strong>
      <span className="card-face__footer">
        <span>コスト {definition.cost ?? "-"}</span>
        <span>力 {definition.basePower ?? "-"}</span>
      </span>
    </button>
  );
}

function CardDetail({
  definition,
}: {
  definition: NonNullable<PublicCardCatalog["definitions"][string]>;
}) {
  return (
    <div className="card-detail">
      <div className="card-detail__title">
        <span
          className={`card-detail__mark card-detail__mark--${definition.attribute}`}
        >
          {cardTypeMark(definition.cardType)}
        </span>
        <div>
          <strong>{definition.name}</strong>
          <span>
            {cardTypeLabel(definition.cardType)} /{" "}
            {attributeLabels[definition.attribute]}
          </span>
        </div>
      </div>
      <dl className="card-detail__stats">
        <div>
          <dt>コスト</dt>
          <dd>{definition.cost ?? "-"}</dd>
        </div>
        <div>
          <dt>攻撃力</dt>
          <dd>{definition.basePower ?? "-"}</dd>
        </div>
      </dl>
      <p>{definition.rulesText}</p>
    </div>
  );
}

function DesktopOnlyNotice() {
  return (
    <main className="desktop-only-notice">
      <p className="route-message__eyebrow">DISASTAR CARD GAME</p>
      <h1>PC 横画面で開いてください</h1>
      <p>対戦画面は幅 1180px、高さ 720px 以上の画面に対応しています。</p>
    </main>
  );
}

function findSelectedCard(
  view: GameBoardFixture["view"],
  cardInstanceId: string | null,
): VisibleCardInstance | undefined {
  if (cardInstanceId === null) {
    return undefined;
  }

  const cards = [
    ...view.self.hand,
    ...view.self.discardPile,
    ...view.self.supportZone,
    ...view.self.attackGroups.flatMap((group) => group.cards),
    ...view.opponent.discardPile,
    ...view.opponent.supportZone,
    ...view.opponent.attackGroups.flatMap((group) => group.cards),
  ];
  return cards.find((card) => card.instanceId === cardInstanceId);
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
