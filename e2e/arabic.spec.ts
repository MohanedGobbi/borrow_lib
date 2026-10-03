import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./fixtures";

async function switchToArabic(page: Page) {
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
}

test.describe("arabic", () => {
  test("switching language mirrors the layout and translates the catalog", async ({ page }) => {
    await signIn(page, "priya@example.com");
    await switchToArabic(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.goto("/catalog");
    await expect(page.getByRole("heading", { level: 1, name: "الفهرس" })).toBeVisible();
    await expect(page.getByRole("button", { name: "طلب", exact: true }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("the overdue block is explained in Arabic, before the click", async ({ page }) => {
    await signIn(page, "daniel@example.com");
    await switchToArabic(page);

    await page.goto("/catalog");
    const request = page.getByRole("button", { name: "طلب", exact: true }).first();
    await expect(request).toHaveAttribute("aria-disabled", "true");
    await expect(request).toHaveAccessibleDescription("أعد «The Name of the Wind» لتتمكن من الطلب مجددًا");
    await expect(page.getByRole("alert").filter({ hasText: "لديك إعارة متأخرة" })).toBeVisible();
  });
});
