import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GameCommandError,
  GameCommandErrorCode,
  GameCommand,
} from "@disastar/game-engine";
import type {
  GameSnapshotResponse,
  PublicCardCatalogResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import type { CardCatalogVersion } from "@disastar/game-engine/contracts";
import { useCallback, useEffect, useState } from "react";
import { ApiClientError, fetchApi } from "../../../app/api-client.ts";

export function gameSnapshotQueryKey(gameId: string) {
  return ["games", gameId, "snapshot"] as const;
}

function fetchGameSnapshot(
  gameId: string,
  afterSequence: number,
): Promise<GameSnapshotResponse> {
  return fetchApi<GameSnapshotResponse>(
    `/api/games/${encodeURIComponent(gameId)}?afterSequence=${afterSequence}`,
  );
}

export function useGameSnapshot(gameId: string) {
  const queryClient = useQueryClient();
  const queryKey = gameSnapshotQueryKey(gameId);
  const [isResynchronizing, setIsResynchronizing] = useState(false);
  const [resynchronizationError, setResynchronizationError] =
    useState<unknown>(null);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<GameSnapshotResponse>(queryKey);
      const afterSequence = previous?.latestEventSequence ?? 0;
      return fetchGameSnapshot(gameId, afterSequence);
    },
    refetchInterval: (query) =>
      query.state.data?.view.status === "finished" ? false : 2_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) =>
      query.state.data?.view.status === "finished" ? false : "always",
  });

  useEffect(() => {
    if (query.dataUpdatedAt > 0) {
      setResynchronizationError(null);
    }
  }, [query.dataUpdatedAt]);

  const resynchronize = useCallback(async () => {
    setIsResynchronizing(true);
    setResynchronizationError(null);
    try {
      await queryClient.cancelQueries({
        queryKey: gameSnapshotQueryKey(gameId),
      });
      const snapshot = await fetchGameSnapshot(gameId, 0);
      queryClient.setQueryData(gameSnapshotQueryKey(gameId), snapshot);
    } catch (error) {
      setResynchronizationError(error);
      throw error;
    } finally {
      setIsResynchronizing(false);
    }
  }, [gameId, queryClient]);

  return {
    ...query,
    isResynchronizing,
    resynchronizationError,
    resynchronize,
  };
}

export function useGameCommand(gameId: string) {
  const queryClient = useQueryClient();
  const queryKey = gameSnapshotQueryKey(gameId);
  const mutation = useMutation({
    mutationFn: (command: GameCommand) =>
      fetchApi<SubmitGameCommandResponse>(
        `/api/games/${encodeURIComponent(gameId)}/commands`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        },
      ),
    retry: (failureCount, error) =>
      !(error instanceof ApiClientError) && failureCount < 2,
    onSuccess: (response) => {
      queryClient.setQueryData<GameSnapshotResponse>(queryKey, (current) => ({
        view: response.view,
        events: response.accepted ? response.events : [],
        latestEventSequence: Math.max(
          current?.latestEventSequence ?? 0,
          ...(response.accepted
            ? response.events.map((event) => event.sequence)
            : []),
        ),
      }));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const rejection =
    mutation.data === undefined || mutation.data.accepted
      ? null
      : mutation.data.error;

  return {
    errorMessage:
      rejection === null
        ? mutation.error === null
          ? null
          : getTransportErrorMessage(mutation.error)
        : getCommandErrorMessage(rejection),
    isPending: mutation.isPending,
    retry: () => {
      if (mutation.variables !== undefined) {
        mutation.mutate(mutation.variables);
      }
    },
    submit: mutation.mutate,
    canRetry: mutation.error !== null && mutation.variables !== undefined,
  };
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

function getTransportErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.status === 401) {
    return "ログイン状態を確認できません。ページを更新してください。";
  }
  return "操作を送信できませんでした。再試行してください。";
}

function getCommandErrorMessage(error: GameCommandError): string {
  const messages: Partial<Record<GameCommandErrorCode, string>> = {
    ATTACK_GROUP_SLOT_UNAVAILABLE: "その攻撃グループ枠は使用できません。",
    CARD_NOT_IN_HAND: "そのカードは手札にありません。",
    CHAIN_NOT_ALLOWED: "その攻撃グループには連鎖できません。",
    INSUFFICIENT_MANA: "みなもとが不足しています。",
    INVALID_PHASE: "フェーズが変わったため、操作をやり直してください。",
    INVALID_TARGET: "選択した対象は使用できません。",
    NOT_CURRENT_PLAYER: "現在は相手の操作時間です。",
    PHASE_DEADLINE_EXPIRED: "フェーズの制限時間が終了しました。",
    PHASE_SEQUENCE_MISMATCH: "盤面が更新されたため、操作をやり直してください。",
    SUPPORT_ALREADY_FINISHED: "このラウンドのサポート操作は終了しています。",
  };

  return messages[error.code] ?? "操作を受け付けられませんでした。";
}
