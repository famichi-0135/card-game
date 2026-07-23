import { useDraggable } from "@dnd-kit/react";
import type {
  AvailableGameActions,
  PublicCardCatalog,
  VisibleCardInstance,
} from "@disastar/game-engine";
import {
  attributeLabels,
  cardTypeLabel,
  cardTypeMark,
} from "./card-presentation.ts";

export function DraggableHandCard({
  card,
  catalog,
  actions,
}: {
  card: VisibleCardInstance;
  catalog: PublicCardCatalog;
  actions: AvailableGameActions["handCards"][string] | undefined;
}) {
  const definition = catalog.definitions[card.definitionId];
  const canDrag = actions?.placeAttack.available === true;
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
    <div ref={ref} className="group relative">
      <button
        ref={handleRef}
        className={`grid h-36 w-28 grid-rows-[auto_1fr_auto_auto] rounded-md border bg-white p-2 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          isDragging ? "opacity-40" : "opacity-100"
        } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${
          canDrag ? "border-slate-400" : "border-slate-300"
        }`}
        type="button"
        aria-label={`${definition.name}。${getActionSummary(actions)}`}
        title={
          canDrag
            ? "ドラッグして攻撃グループへ配置"
            : "このカードは現在のフェーズでは配置できません"
        }
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
