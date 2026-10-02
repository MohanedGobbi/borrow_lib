import { chromium } from "@playwright/test";
import { PASSWORD, STAFF } from "./fixtures";

/**
 * The suite runs against Vite dev servers, which compile each lazy route (and re-bundle dependencies,
 * reloading the page) the first time it is requested. Visiting every route once up front keeps that
 * one-off cost out of the tests, so their waits can stay short and honest.
 * Best effort: a failure here never fails the run; the tests report real problems themselves.
 */
const PAGES = [
  "/", "/catalog", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/books/1",
  "/my-requests", "/cart", "/profile", "/demo/mailbox",
  "/staff", "/staff/approvals", "/staff/pickups", "/staff/loans", "/staff/inventory", "/staff/inventory/import",
  "/staff/reservations", "/staff/users", "/staff/analytics", "/staff/activity",
];

export default async function globalSetup() {
  const urls = (process.env.E2E_WARM_URLS ?? "").split(",").filter(Boolean);
  if (!urls.length) return;
  const browser = await chromium.launch();
  try {
    await Promise.all(urls.map(async (baseURL) => {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await page.goto("/login");
        await page.getByLabel("Email").fill(STAFF);
        await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.getByRole("button", { name: "Account" }).waitFor({ timeout: 60_000 });
        for (const path of PAGES) {
          await page.goto(path);
          await page.locator("main").waitFor({ timeout: 60_000 });
          await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
        }
      } catch {
        // best effort
      } finally {
        await context.close();
      }
    }));
  } finally {
    await browser.close();
  }
}
