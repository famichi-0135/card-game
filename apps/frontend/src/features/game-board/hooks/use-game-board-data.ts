import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GameSnapshotResponse,
  PublicCardCatalogResponse,
} from "@disastar/contracts/game";
import type { CardCatalogVersion } from "@disastar/game-engine/contracts";
import { fetchApi } from "../../../app/api-client.ts";

export function useGameSnapshot(gameId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["games", gameId, "snapshot"] as const;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<GameSnapshotResponse>(queryKey);
      const afterSequence = previous?.latestEventSequence ?? 0;
      return fetchApi<GameSnapshotResponse>(
        `/api/games/${encodeURIComponent(gameId)}?afterSequence=${afterSequence}`,
      );
    },
    refetchInterval: (query) =>
      query.state.data?.view.status === "finished" ? false : 2_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) =>
      query.state.data?.view.status === "finished" ? false : "always",
  });
}

export function usePublicCardCatalog(
  cardCatalogVersion: CardCatalogVersion | undefined,
) {
  return useQuery({
    queryKey: ["card-catalogs", cardCatalogVersion],
    queryFn: () =>
      fetchApi<PublicCardCatalogResponse>(
        `/api/card-catalogs/${encodeURIComponent(cardCatalogVersion ?? "")}`,
      ),
    enabled: cardCatalogVersion !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
