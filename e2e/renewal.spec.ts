import { expect, test, type Page } from "@playwright/test";
import { expectToast, signIn, signOut, STAFF } from "./fixtures";

const ADMIN = "admin@libborrow.dev";

// Sofia's loan of Dune is due in two days (inside the 3-day renewal window), nobody waits for Dune, and
// no other spec touches that loan. Priya's loan of The Selfish Gene is due in a week: not yet renewable.
const RENEWABLE_MEMBER = "sofia@example.com";
const RENEWABLE_BOOK = "Dune";
const EARLY_MEMBER = "priya@example.com";
const EARLY_BOOK = "The Selfish Gene";

const loanRow = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

async function setHoldHours(page: Page, hours: string) {
  await page.goto("/staff/settings");
  await page.getByLabel("Hold period (hours)").fill(hours);
  await page.getByRole("button", { name: "Save changes" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Save these changes?" });
  await expect(dialog).toContainText(`New holds will last ${hours} hours. Existing holds keep their deadlines.`);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expectToast(page, "Library rules saved.");
}

test.describe("renewals and circulation rules", () => {
  test("a member renews a loan that is due within 3 days and sees the new due date", async ({ page }) => {
    await signIn(page, RENEWABLE_MEMBER);
    await page.goto("/my-requests");
    const row = loanRow(page, RENEWABLE_BOOK);
    await expect(row).toContainText("2 days left");

    await row.getByRole("button", { name: `Renew “${RENEWABLE_BOOK}”` }).click();
    const done = row.getByRole("status").filter({ hasText: "Renewed." });
    await expect(done).toContainText(/New due date: \d{1,2} \w{3} \d{4}/);

    // The list refreshes: sixteen days left now, and the one renewal is used up.
    await expect(row).toContainText("16 days left");
    await page.reload();
    const after = loanRow(page, RENEWABLE_BOOK);
    await expect(after).toContainText("Already renewed once");
    await expect(after.getByRole("button", { name: `Renew “${RENEWABLE_BOOK}”` })).toBeDisabled();
  });

  test("a loan that is not due yet says when it can be renewed", async ({ page }) => {
    await signIn(page, EARLY_MEMBER);
    await page.goto("/my-requests");
    const row = loanRow(page, EARLY_BOOK);
    const button = row.getByRole("button", { name: `Renew “${EARLY_BOOK}”` });
    await expect(button).toBeDisabled();
    // The reason is text beside the button, not a tooltip.
    await expect(row).toContainText(/Renewable from \d{1,2} \w{3} \d{4}/);
  });

  test("an admin changes the hold period and the public copy follows; staff cannot", async ({ page }) => {
    await signIn(page, STAFF);
    await expect(page.getByRole("link", { name: "Library rules" })).toHaveCount(0);
    await page.goto("/staff/settings");
    await expect(page.getByRole("heading", { name: "Administrator access required" })).toBeVisible();
    await signOut(page);

    await signIn(page, ADMIN);
    await page.goto("/staff/settings");
    await expect(page.getByLabel("Hold period (hours)")).toHaveValue("48");

    // Out-of-range values are caught before anything is sent.
    await page.getByLabel("Hold period (hours)").fill("0");
    await expect(page.getByText("Enter a whole number from 1 to 168.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

    try {
      await setHoldHours(page, "24");
      await page.goto("/");
      await expect(page.getByText("Pick it up within 24 hours")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toContainText("Pickup window 24 hours");
      await page.goto("/staff/activity");
      await expect(page.getByRole("row").filter({ hasText: "Changed the library rules: hold hours 24." })).toBeVisible();
    } finally {
      // Django keeps its state across specs: put the rule back whatever happened above.
      await setHoldHours(page, "48");
    }
    await page.goto("/");
    await expect(page.getByText("Pick it up within 48 hours")).toBeVisible();
  });
});
