import { useDraggable } from "@dnd-kit/react";
import type {
  AvailableGameActions,
  PublicCardCatalog,
  VisibleCardInstance,
} from "@disastar/game-engine";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card.tsx";
import { UI_LAYER_CLASS } from "@/components/ui/ui-layers.ts";
import {
  cardTypeLabel,
  cardTypeMark,
  getAttributeLabel,
  getChainableCardNames,
} from "./card-presentation.ts";
import { BoardCard } from "./board-card.tsx";
import { cn } from "@/lib/utils";

export function DraggableHandCard({
  card,
  catalog,
  isSelected = false,
  onSelect,
  actions,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  isSelected?: boolean;
  onSelect?: (cardInstanceId: string) => void;
  actions: AvailableGameActions["handCards"][string] | undefined;
}) {
  const definition = catalog.definitions[card.definitionId];
  const canDrag = isHandCardDraggable(actions);
  const { ref, handleRef, isDragging } = useDraggable({
    id: `hand-card-${card.instanceId}`,
    type: "hand-card",
    disabled: !canDrag,
    data: { cardInstanceId: card.instanceId },
  });

  if (definition === undefined) {
    return null;
  }

  return (
    <div ref={ref} className="group relative shrink-0">
      <HoverCard>
        <HoverCardTrigger render={<div className="relative" />}>
          <button
            ref={handleRef}
            className={cn(
              "relative block rounded-[3px] text-left transition-opacity motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1cd7a]",
              isDragging ? "opacity-40" : "opacity-100",
              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isSelected &&
                "ring-2 ring-[#e5bf65] ring-offset-2 ring-offset-[#091116]",
            )}
            aria-pressed={isSelected}
            type="button"
            onKeyDownCapture={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSelect?.(card.instanceId);
              }
            }}
            onClick={() => onSelect?.(card.instanceId)}
            aria-label={`${definition.name}。${getActionSummary(actions)}`}
            title={
              canDrag
                ? actions?.playSupport.available
                  ? "クリックまたはEnterで選択してから、サポートゾーンで使用"
                  : actions?.discard.available
                    ? "クリックまたはEnterで選択してから、攻撃グループへ配置、連鎖、または捨て札へ破棄"
                    : "クリックまたはEnterで選択してから、攻撃グループへ配置または連鎖"
                : "このカードは現在のフェーズでは配置できません"
            }
          >
            <BoardCard
              definition={definition}
              sequenceLabel={cardTypeMark(definition.cardType)}
              size="hand"
              tone="self"
            />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="center"
          className={cn(
            "w-[280px] border border-[#9a7b45] bg-[#050b10] p-[14px] text-sm text-[#dee7e9] shadow-[0_18px_48px_rgba(0,0,0,.82),inset_0_0_24px_rgba(0,0,0,.8)] [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)]",
            UI_LAYER_CLASS.toast,
          )}
          side="top"
          sideOffset={9}
        >
          <CardPreviewContent catalog={catalog} definition={definition} />
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export function isHandCardDraggable(
  actions: AvailableGameActions["handCards"][string] | undefined,
): boolean {
  return (
    actions !== undefined &&
    (actions.placeAttack.available ||
      actions.chainAttack.available ||
      actions.discard.available ||
      actions.playSupport.available)
  );
}

function CardPreviewContent({
  catalog,
  definition,
}: {
  catalog: PublicCardCatalog;
  definition: NonNullable<PublicCardCatalog["definitions"][string]>;
}) {
  const chainableCardNames = getChainableCardNames(catalog, definition);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#91a6ad]">
            {cardTypeLabel(definition.cardType)} /{" "}
            {getAttributeLabel(definition.faction, definition.attribute)}
          </p>
          <strong>{definition.name}</strong>
        </div>
        <span className="text-2xl text-[#e5c778]" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <dl className="mt-3 flex gap-4 border-y border-white/[.09] py-2 text-xs">
        <div>
          <dt className="text-[#91a6ad]">コスト</dt>
          <dd className="font-semibold">{definition.cost ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-[#91a6ad]">攻撃力</dt>
          <dd className="font-semibold">{definition.basePower ?? "-"}</dd>
        </div>
      </dl>
      <p className="mt-3 whitespace-pre-line text-xs leading-5 text-[#c1ced2]">
        {definition.rulesText}
      </p>
      {definition.cardType === "attack" ? (
        <p className="mt-3 border-t border-white/[.1] pt-3 text-xs leading-5 text-[#c1ced2]">
          <span className="text-[#91a6ad]">連鎖可能なカード: </span>
          {chainableCardNames.length === 0
            ? "なし"
            : chainableCardNames.join("、")}
        </p>
      ) : null}
    </>
  );
}

function getActionSummary(
  actions: AvailableGameActions["handCards"][string] | undefined,
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
