import { expect, test } from "@playwright/test";
import { expectToast, openBook, signIn } from "./fixtures";

// Meditations has 3 copies, all on the shelf, and no other spec touches it. Sara has room under her limit.
const FREE_BOOK = "Meditations";
// Guns, Germs, and Steel has both copies on loan and one student (Priya) already waiting. Hana joins behind her.
const WAITING_BOOK = "Guns, Germs, and Steel";

test.describe("student control", () => {
  test("a student cancels a request from My loans and the book's free count is back", async ({ page }) => {
    await signIn(page, "sara@example.com");
    await openBook(page, FREE_BOOK);
    await expect(page.getByText("3 / 3 available")).toBeVisible();

    await page.getByRole("button", { name: "Request this book" }).click();
    await expectToast(page, "Request sent");
    const confirmation = page.getByRole("status").filter({ hasText: "Requested." });
    await expect(confirmation).toContainText("you'll then have 48 hours to collect it at the desk");
    await expect(confirmation.getByRole("link", { name: "View in My loans" })).toBeVisible();

    await confirmation.getByRole("link", { name: "View in My loans" }).click();
    const row = page.getByRole("listitem").filter({ hasText: FREE_BOOK });
    await expect(row).toContainText("Pending approval");
    await row.getByRole("button", { name: "Cancel request" }).click();

    // The dialog names the book; "Keep it" is the safe default.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Cancel this request?");
    await expect(dialog).toContainText(`“${FREE_BOOK}”`);
    await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel request" }).click();
    await expectToast(page, "Request cancelled");

    // Gone from the current list, and recorded in the history as the student's own doing.
    await expect(page.getByRole("button", { name: "Cancel request" })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: FREE_BOOK })).toContainText("You cancelled this request.");

    await openBook(page, FREE_BOOK);
    await expect(page.getByText("3 / 3 available")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request this book" })).toBeVisible();
  });

  test("a student joins a waiting list, sees their place inline, then leaves", async ({ page }) => {
    await signIn(page, "hana@example.com");
    await openBook(page, WAITING_BOOK);
    await expect(page.getByText("All copies are on loan")).toBeVisible();

    await page.getByRole("button", { name: "Join waiting list" }).click();
    await expectToast(page, "You joined the waiting list");
    const confirmation = page.getByRole("status").filter({ hasText: "in line" });
    await expect(confirmation).toContainText("You're #2 in line.");
    await expect(confirmation).toContainText("held for the first person in line for 48 hours");

    await confirmation.getByRole("link", { name: "View your waiting lists" }).click();
    const list = page.getByRole("listitem").filter({ hasText: WAITING_BOOK });
    await expect(list).toContainText("Position 2");
    await list.getByRole("button", { name: "Leave waiting list" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Leave the waiting list?");
    await expect(dialog).toContainText(`“${WAITING_BOOK}”`);
    await dialog.getByRole("button", { name: "Leave waiting list" }).click();
    await expectToast(page, "You left the waiting list");
    // (Hana is still waiting for Clean Code, so the list itself stays.)
    await expect(page.getByRole("link", { name: WAITING_BOOK })).toHaveCount(0);

    // The way back in is open again.
    await openBook(page, WAITING_BOOK);
    await expect(page.getByRole("button", { name: "Join waiting list" })).toBeVisible();
  });
});
