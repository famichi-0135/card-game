import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
  VisibleAttackGroup,
} from "@disastar/game-engine";
import { AttackGroupRow } from "./attack-group-row.tsx";

export function CardField({
  availableActions,
  catalog,
  onOpenSelfGroup,
  opponentGroups,
  selfGroups,
}: {
  availableActions?: AvailableGameActions;
  catalog: PublicCardCatalog;
  onOpenSelfGroup: (group: VisibleAttackGroup) => void;
  opponentGroups: PlayerGameView["opponent"]["attackGroups"];
  selfGroups: PlayerGameView["self"]["attackGroups"];
}) {
  return (
    <section
      aria-label="カード配置フィールド"
      className="grid min-h-0 grid-rows-2 gap-5 rounded-md border border-slate-300 bg-slate-50 p-3"
      data-board-region="card-field"
    >
      <AttackGroupRow
        catalog={catalog}
        groups={opponentGroups}
        label="相手の攻撃グループ"
        perspective="opponent"
      />
      <AttackGroupRow
        availableActions={availableActions}
        catalog={catalog}
        groups={selfGroups}
        label="自分の攻撃グループ"
        onOpenGroup={onOpenSelfGroup}
        perspective="self"
      />
    </section>
  );
}
