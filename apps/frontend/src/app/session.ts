import { useQuery } from "@tanstack/react-query";
import { ApiClientError, fetchApi } from "./api-client.ts";

type SessionResponse = {
  user: {
    id: string;
    name?: string | null;
  };
};

async function getSession(): Promise<SessionResponse | null> {
  try {
    return await fetchApi<SessionResponse>("/api/auth/get-session");
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
