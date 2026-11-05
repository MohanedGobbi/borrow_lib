import { useQuery } from "@tanstack/react-query";
import { apiDemo } from "@/api";
import { qk } from "@/api/queryKeys";

/** The hosted demo's shared accounts, or null on a real library. Asked once per visit. */
export function useDemo() {
  const query = useQuery({ queryKey: qk.demo, queryFn: apiDemo.info, staleTime: Infinity, retry: false });
  return query.data ?? null;
}
