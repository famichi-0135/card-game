import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
  VisibleAttackGroup,
} from "@disastar/game-engine";
import { AttackGroupRow } from "./attack-group-row.tsx";
import type { GameBoardCardTarget } from "../hooks/use-game-board-actions.ts";

export function CardField({
  availableActions,
  catalog,
  hasSelectedCard = false,
  onOpenSelfGroup,
  onSelectTarget,
  opponentGroups,
  selfGroups,
}: {
  availableActions?: AvailableGameActions;
  catalog: PublicCardCatalog;
  hasSelectedCard?: boolean;
  onOpenSelfGroup: (group: VisibleAttackGroup) => void;
  onSelectTarget?: (target: GameBoardCardTarget) => boolean;
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
        hasSelectedCard={hasSelectedCard}
        groups={opponentGroups}
        label="相手の攻撃グループ"
        perspective="opponent"
      />
      <AttackGroupRow
        availableActions={availableActions}
        catalog={catalog}
        hasSelectedCard={hasSelectedCard}
        groups={selfGroups}
        label="自分の攻撃グループ"
        onOpenGroup={onOpenSelfGroup}
        onSelectTarget={onSelectTarget}
        perspective="self"
      />
    </section>
  );
}
