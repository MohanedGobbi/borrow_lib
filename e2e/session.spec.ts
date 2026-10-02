import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./fixtures";

test.describe("session", () => {
  test("survives a reload, keeps no tokens in localStorage, and ends on sign out", async ({ page }) => {
    await signIn(page, "priya@example.com");

    await page.reload();
    await expect(page.getByRole("button", { name: "Account" })).toBeVisible();

    const stored = await page.evaluate(() => ({
      access: localStorage.getItem("lb_access"),
      refresh: localStorage.getItem("lb_refresh"),
    }));
    expect(stored).toEqual({ access: null, refresh: null });

    await signOut(page);
    await page.reload();
    await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Account" })).toHaveCount(0);

    // A protected page sends a signed-out visitor to the sign-in form.
    await page.goto("/my-requests");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
