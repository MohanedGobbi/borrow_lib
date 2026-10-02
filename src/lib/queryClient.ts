import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/client";

/** Never retry a request the server rejected (4xx: bad input, no access, not found); retry the rest twice. */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: shouldRetry },
    mutations: { retry: 0 },
  },
});
