import { expect, test } from "@playwright/test";
import { expectToast, openBook, signIn } from "./fixtures";

// Daniel has an overdue loan (The Name of the Wind), so he cannot request anything new.
test.describe("overdue block", () => {
  test("a member with an overdue loan cannot request a book", async ({ page }) => {
    await signIn(page, "daniel@example.com");
    await openBook(page, "Atomic Habits");

    await page.getByRole("button", { name: "Request this book" }).click();
    await expectToast(page, "You have an overdue loan. Return it before requesting new books.");

    await page.goto("/my-requests");
    await expect(page.getByText("New requests are blocked")).toBeVisible();
    await expect(page.getByRole("link", { name: "Atomic Habits" })).toHaveCount(0);
  });
});
