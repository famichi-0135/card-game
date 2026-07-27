import { useQuery } from "@tanstack/react-query";
import type { AuthenticatedSessionResponse } from "@disastar/contracts/session";
import { ApiClientError, fetchApi } from "./api-client.ts";

async function getSession(): Promise<AuthenticatedSessionResponse | null> {
  try {
    return await fetchApi<AuthenticatedSessionResponse>("/api/session");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: getSession,
  });
}
