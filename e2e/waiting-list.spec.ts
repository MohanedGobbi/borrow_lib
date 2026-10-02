import { expect, test } from "@playwright/test";
import { expectToast, openBook, openNotifications, rowWith, signIn, signOut, STAFF } from "./fixtures";

// The Gene has 2 copies, both on loan (Amira and Karim) and nobody waiting. Used by this spec only.
const BOOK = "The Gene: An Intimate History";
const MEMBER = "sofia@example.com";

test.describe("waiting list", () => {
  test("a returned copy is held for the first student in the queue", async ({ page }) => {
    await signIn(page, MEMBER);
    await openBook(page, BOOK);
    await expect(page.getByText("All copies are on loan")).toBeVisible();

    await page.getByRole("button", { name: "Join waiting list" }).click();
    await expectToast(page, "You joined the waiting list");

    await page.goto("/my-requests");
    await expect(page.getByRole("link", { name: BOOK })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Waiting lists/ })).toBeVisible();
    await signOut(page);

    await signIn(page, STAFF);
    await page.goto("/staff/loans");
    await rowWith(page, "Amira Haddad", BOOK).getByRole("button", { name: "Confirm return" }).click();
    await expectToast(page, "Return confirmed");
    await signOut(page);

    await signIn(page, MEMBER);
    await page.goto("/my-requests");
    const hold = page.getByRole("listitem").filter({ hasText: BOOK });
    await expect(hold).toContainText("Ready for pickup");

    const bell = await openNotifications(page);
    await expect(bell).toContainText(`“${BOOK}” is now held for you`);
  });
});
