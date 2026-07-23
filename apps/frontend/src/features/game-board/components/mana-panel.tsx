import type { Attribute, PlayerGameView } from "@disastar/game-engine";
import { attributeLabels } from "./card-presentation.ts";

const attributes: readonly Attribute[] = [
  "attributeA",
  "attributeB",
  "attributeC",
];

export function ManaPanel({ player }: { player: PlayerGameView["self"] }) {
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
