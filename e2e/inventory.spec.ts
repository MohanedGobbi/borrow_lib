import { expect, test } from "@playwright/test";
import { expectToast, openBook, signIn, STAFF } from "./fixtures";

// Meditations (3 copies, none on loan) gets a new shelf mark; Structure and Interpretation of
// Computer Programs (no loans or requests) is deleted. Used by this spec only.
const EDITED = "Meditations";
const DELETED = "Structure and Interpretation of Computer Programs";

test.describe("inventory", () => {
  test("staff edit a shelf location and delete a book with no loans", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/inventory");

    await page.getByLabel("Filter by title, author, ISBN or shelf").fill(EDITED);
    await page.getByRole("button", { name: `Edit: ${EDITED}` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit book" });
    await dialog.getByLabel("Shelf mark").fill("NON-E-99");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expectToast(page, "Book saved");

    await openBook(page, EDITED);
    await expect(page.getByText("NON-E-99").first()).toBeVisible();

    await page.goto("/staff/inventory");
    await page.getByLabel("Filter by title, author, ISBN or shelf").fill(DELETED);
    await page.getByRole("button", { name: `Delete book: ${DELETED}` }).click();
    await expectToast(page, "Book deleted");

    await page.goto(`/catalog?q=${encodeURIComponent("Structure and Interpretation")}`);
    await expect(page.getByText("No titles match your search.")).toBeVisible();
  });
});
