import type { Attribute, PlayerGameView } from "@disastar/game-engine";
import type { ReactNode } from "react";
import { attributeLabels } from "./card-presentation.ts";

const attributes: readonly Attribute[] = [
  "attributeA",
  "attributeB",
  "attributeC",
];

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

export function ManaPanel({
  footer,
  label,
  player,
}: {
  footer?: ReactNode;
  label: string;
  player: BoardPlayer;
}) {
  return (
    <section
      aria-label={`${label}のみなもと`}
      className="min-h-0 overflow-hidden rounded-md border border-slate-300 bg-white p-2"
    >
      <p className="text-xs font-medium text-slate-500">{label}のみなもと</p>
      <dl className="mt-1 grid gap-0.5">
        {attributes.map((attribute) => {
          const mana = player.mana[attribute];
          return (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
              key={attribute}
            >
              <div className="min-w-0">
                <dt className="truncate text-sm">
                  {attributeLabels[attribute]}
                </dt>
                <dd className="whitespace-nowrap text-xs text-slate-500">
                  使用可 / {mana.total}
                </dd>
              </div>
              <strong className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs tabular-nums">
                {mana.available}
              </strong>
            </div>
          );
        })}
      </dl>
      {footer === undefined ? null : <div className="mt-1">{footer}</div>}
    </section>
  );
}
