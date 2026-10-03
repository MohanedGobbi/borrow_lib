import { expect, test } from "@playwright/test";
import { expectToast, openBook, rowWith, signIn, signOut, STAFF } from "./fixtures";

// Hana requests The Selfish Gene (3 copies, 1 on loan). Used by this spec only.
const MEMBER = "hana@example.com";
const BOOK = "The Selfish Gene";

test.describe("circulation", () => {
  test("request, approve, pick up and return a book", async ({ page }) => {
    await signIn(page, MEMBER);
    await openBook(page, BOOK);
    await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Request this book" }).click();
    await expectToast(page, "Request sent");

    await page.goto("/my-requests");
    const mine = page.getByRole("listitem").filter({ hasText: BOOK });
    await expect(mine).toContainText("Pending approval");
    await signOut(page);

    await signIn(page, STAFF);
    await page.goto("/staff/approvals");
    await rowWith(page, "Hana Yoshida", BOOK).getByRole("button", { name: "Approve" }).click();
    await expectToast(page, "Approved");
    // Approving has the 8-second Undo window like pickup and return: the row leaves the list once it is sent.
    await expect(rowWith(page, "Hana Yoshida", BOOK)).toHaveCount(0, { timeout: 20_000 });

    await page.goto("/staff/pickups");
    await rowWith(page, "Hana Yoshida", BOOK).getByRole("button", { name: "Confirm pickup" }).click();
    await expectToast(page, "Pickup confirmed");

    await openBook(page, BOOK);
    await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();

    await page.goto("/staff/loans");
    await rowWith(page, "Hana Yoshida", BOOK).getByRole("button", { name: "Confirm return" }).click();
    await expectToast(page, "Return confirmed");

    await openBook(page, BOOK);
    await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  });
});
