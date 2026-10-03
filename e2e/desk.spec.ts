import { expect, test } from "@playwright/test";
import { expectToast, openBook, openNotifications, rowWith, signIn, signOut, STAFF } from "./fixtures";

const FILTER = "Filter by member, book, ISBN or shelf mark";

test.describe("circulation desk", () => {
  // Read-only: Hana's workstation is opened, nothing is changed.
  test("desk search finds a member, and a scanned card link opens the same workstation", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/pickups");
    const search = page.getByRole("combobox", { name: /^Scan library card/ });
    await expect(search).toBeVisible();

    await page.keyboard.press("/");
    await expect(search).toBeFocused();
    await search.fill("Yoshida");
    await expect(page.getByRole("option", { name: /Hana Yoshida/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/scan\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hana Yoshida" })).toBeVisible();
    const card = page.url();

    // A card scanner types the card's link and presses Enter.
    await page.goto("/staff");
    await expect(search).toBeVisible();
    await page.keyboard.press("/");
    await search.fill(card);
    await search.press("Enter");
    await expect(page).toHaveURL(card);
    await expect(page.getByRole("heading", { level: 1, name: "Hana Yoshida" })).toBeVisible();
  });

  // Read-only: Tomás Rivera's pickup of The Silk Roads is confirmed and taken back; nothing is sent.
  test("Undo takes back a confirmed pickup before anything is sent", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/pickups");
    const row = rowWith(page, "Tomás Rivera", "The Silk Roads");
    await row.getByRole("button", { name: "Confirm pickup" }).click();
    await expect(row).toContainText("Pickup confirmed");
    await row.getByRole("button", { name: "Undo" }).click();
    await expect(row.getByRole("button", { name: "Confirm pickup" })).toBeVisible();

    await page.waitForTimeout(9_000); // longer than the undo window
    await page.reload();
    await expect(rowWith(page, "Tomás Rivera", "The Silk Roads").getByRole("button", { name: "Confirm pickup" })).toBeVisible();
  });

  // Omar requests Atomic Habits; staff reject it with a reason. Used by this spec only.
  test("a rejection asks first, and the student sees the reason", async ({ page }) => {
    const reason = "Reference copy only, cannot be borrowed.";
    await signIn(page, "omar@example.com");
    await openBook(page, "Atomic Habits");
    await page.getByRole("button", { name: "Request this book" }).click();
    await expectToast(page, "Request sent");
    await signOut(page);

    await signIn(page, STAFF);
    await page.goto("/staff/approvals");
    await page.getByLabel(FILTER).fill("Omar");
    const row = rowWith(page, "Omar Trabelsi", "Atomic Habits");
    await row.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Reject this request?" });
    await dialog.getByLabel("Reason (optional)").fill(reason);
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expectToast(page, "Request rejected");
    await expect(rowWith(page, "Omar Trabelsi", "Atomic Habits")).toHaveCount(0);
    await signOut(page);

    await signIn(page, "omar@example.com");
    await page.goto("/my-requests");
    await expect(page.locator("main")).toContainText(`Reason from the library: ${reason}`);
    const bell = await openNotifications(page);
    await expect(bell).toContainText(`Reason: ${reason}`);
  });
});
