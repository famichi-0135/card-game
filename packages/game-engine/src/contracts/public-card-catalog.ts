import type { Attribute, Faction, SupportDuration } from "./card-definition.js";
import type {
  CardCatalogVersion,
  CardDefinitionId,
  EffectId,
} from "./identifiers.js";
import type { EffectActivationType } from "./effect-definition.js";
import type { TargetSide, TargetZone } from "./effect-target.js";

/** クライアントに公開してよい、カード画像の論理識別子。初期カタログはnullを返す。 */
export type CardImageAssetId = string | null;

/** 効果解決の内部設定を含まない、UIの対象選択用メタデータ。 */
export type PublicCardEffectInteraction = {
  effectId: EffectId;
  activationType: EffectActivationType;
  target: {
    required: boolean;
    minTargets: number;
    maxTargets: number;
    side: TargetSide;
    zones: TargetZone[];
    allowSourceCard: boolean;
    selectionOrder: "independent";
  };
};

export type PublicCardInteraction = {
  chainableCardDefinitionIds: CardDefinitionId[];
  effects: PublicCardEffectInteraction[];
};

/** 公開 API とフロントエンドで共有する、表示専用のカード定義。 */
export type PublicCardDefinition = {
  id: CardDefinitionId;
  name: string;
  faction: Faction;
  attribute: Attribute;
  cardType: "mana" | "attack" | "support";
  manaAmount?: 1;
  cost?: number;
  basePower?: number;
  duration?: SupportDuration;
  rulesText: string;
  imageAssetId: CardImageAssetId;
  interaction: PublicCardInteraction;
};

export type PublicCardCatalog = {
  version: CardCatalogVersion;
  definitions: Record<CardDefinitionId, PublicCardDefinition>;
};
