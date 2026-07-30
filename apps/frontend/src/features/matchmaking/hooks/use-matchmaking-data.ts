import { useQuery } from "@tanstack/react-query";
import { getMatch, listDecks, listPublicMatches } from "../matchmaking-api.ts";

export const savedDecksQueryKey = ["decks"] as const;
export const publicMatchesQueryKey = ["matches", "public"] as const;

export function matchLobbyQueryKey(matchId: string) {
  return ["matches", matchId] as const;
}

export function useSavedDecks(enabled = true) {
  return useQuery({
    queryKey: savedDecksQueryKey,
    queryFn: listDecks,
    enabled,
  });
}

export function useMatchLobby(matchId: string) {
  return useQuery({
    queryKey: matchLobbyQueryKey(matchId),
    queryFn: () => getMatch(matchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "started" || status === "cancelled" ? false : 2_000;
    },
  });
}

export function usePublicMatchLobbies(enabled = true) {
  return useQuery({
    queryKey: publicMatchesQueryKey,
    queryFn: listPublicMatches,
    enabled,
    refetchInterval: 5_000,
  });
}
