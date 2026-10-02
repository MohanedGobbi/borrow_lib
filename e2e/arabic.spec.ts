import { expect, test, type Page } from "@playwright/test";
import { expectToast, signIn } from "./fixtures";

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

  test("the overdue block is explained in Arabic", async ({ page }) => {
    await signIn(page, "daniel@example.com");
    await switchToArabic(page);

    await page.goto("/catalog");
    await page.getByRole("button", { name: "طلب", exact: true }).first().click();
    await expectToast(page, "لديك إعارة متأخرة. أعدها قبل طلب كتب جديدة.");
  });
});
