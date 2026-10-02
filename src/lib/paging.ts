import { ApiError } from "@/api/client";
import type { Page } from "@/types";

/**
 * Fetch `page`; if it no longer exists (404: the list shrank, or the URL is stale)
 * fall back to the first page. Read the page actually shown from `result.page`.
 */
export async function fetchPage<T>(load: (page: number) => Promise<Page<T>>, page: number): Promise<Page<T>> {
  try {
    return await load(page);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && page > 1) return load(1);
    throw e;
  }
}
