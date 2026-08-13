import type {
  AvailableGameActions,
  PlayerGameView,
  PublicCardCatalog,
  VisibleAttackGroup,
} from "@disastar/game-engine";
import { AttackGroupRow } from "./attack-group-row.tsx";
import { getBoardBackgroundImage } from "./game-board-background.ts";
import { GameFrame } from "./game-ui/index.ts";
import type { GameBoardCardTarget } from "../hooks/use-game-board-actions.ts";

export function CardField({
  availableActions,
  catalog,
  hasSelectedCard = false,
  onOpenSelfGroup,
  onSelectTarget,
  opponentGroups,
  selfGroups,
  selectedCardInstanceId,
}: {
  availableActions?: AvailableGameActions;
  catalog: PublicCardCatalog;
  hasSelectedCard?: boolean;
  onOpenSelfGroup: (group: VisibleAttackGroup) => void;
  onSelectTarget?: (target: GameBoardCardTarget) => boolean;
  opponentGroups: PlayerGameView["opponent"]["attackGroups"];
  selfGroups: PlayerGameView["self"]["attackGroups"];
  selectedCardInstanceId?: string;
}) {
  const slotWithSelectedCard = selectedCardInstanceId
    ? availableActions?.handCards?.[selectedCardInstanceId]
        ?.placeAttack?.available
        ? selectedCardInstanceId
        : undefined
    : undefined;

  return (
    <GameFrame
      as="section"
      aria-label="カード配置フィールド"
      className="grid min-h-0 grid-rows-2 gap-[10px] bg-[#061016] p-[14px]"
      data-board-region="card-field"
      data-board-background-asset="backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png"
      style={{
        backgroundImage: `linear-gradient(rgba(3, 11, 16, .78), rgba(3, 11, 16, .86)), ${getBoardBackgroundImage()}`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      variant="gray"
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
        selectedCardInstanceId={slotWithSelectedCard}
      />
    </GameFrame>
  );
}
