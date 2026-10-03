import { expect, test } from "@playwright/test";
import { rowWith, signIn, STAFF } from "./fixtures";

// Read-only checks of the desk queues: keyboard focus, the loans filter, and Return from the book and the search.
// Every action is taken back with Undo before anything is sent.

test.describe("desk queues", () => {
  test("J and K move the row focus on Pickups, and the row says it is selected", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/pickups");
    const rows = page.locator("tbody tr[data-row-id]");
    await expect(rows.first()).toBeVisible();
    await expect(page.getByText("Keyboard shortcuts")).toBeVisible();

    await page.keyboard.press("j");
    await expect(rows.nth(0)).toBeFocused();
    await expect(rows.nth(0)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("j");
    await expect(rows.nth(1)).toBeFocused();
    await expect(rows.nth(0)).toHaveAttribute("aria-selected", "false");
    await page.keyboard.press("k");
    await expect(rows.nth(0)).toBeFocused();

    // Typing in the filter box is never taken for a shortcut.
    const filter = page.getByLabel("Filter by member, book, ISBN or shelf mark");
    await filter.fill("jk");
    await expect(filter).toHaveValue("jk");
  });

  test("on Approvals A approves with an Undo window, and Undo takes it back", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/approvals");
    const rows = page.locator("tbody tr[data-row-id]");
    await expect(rows.first()).toBeVisible();
    await rows.first().focus();
    await page.keyboard.press("a");
    await expect(rows.first()).toContainText("Approved");
    await rows.first().getByRole("button", { name: /^Undo/ }).click();
    await expect(rows.first().getByRole("button", { name: /^Approve / })).toBeVisible();

    // R opens the reject dialog for the focused row.
    await rows.first().focus();
    await page.keyboard.press("r");
    await expect(page.getByRole("alertdialog", { name: "Reject this request?" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("the Loans filter narrows the list on the server", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/loans");
    const overdue = page.getByRole("button", { name: /^Overdue \(\d+\)$/ });
    await expect(overdue).toBeVisible();
    const n = Number(/\((\d+)\)/.exec((await overdue.textContent()) ?? "")![1]);
    expect(n).toBeGreaterThan(0);

    await overdue.click();
    await expect(overdue).toHaveAttribute("aria-pressed", "true");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(n);
    for (const row of await rows.all()) await expect(row).toContainText("Overdue");

    const due = page.getByRole("button", { name: /^Due within 3 days \(\d+\)$/ });
    await due.click();
    await expect(due).toHaveAttribute("aria-pressed", "true");
    await expect(rowWith(page, "Overdue")).toHaveCount(0);

    // A loan that cannot be renewed shows no Renew button: the row stays quiet.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(rowWith(page, "Daniel Okafor", "The Name of the Wind").getByRole("button", { name: /Renew/ })).toHaveCount(0);
  });

  test("Return can start from the book page and from the desk search", async ({ page }) => {
    // The Design of Everyday Things has one active loan (Tomás, overdue).
    await signIn(page, STAFF);
    await page.goto("/catalog?q=Everyday");
    await page.getByRole("link", { name: "The Design of Everyday Things", exact: true }).click();
    const borrower = rowWith(page, "Tomás Rivera");
    await borrower.getByRole("button", { name: "Confirm return" }).click();
    await expect(borrower).toContainText("Return confirmed");
    await borrower.getByRole("button", { name: /^Undo/ }).click();
    await expect(borrower.getByRole("button", { name: "Confirm return" })).toBeVisible();

    await page.goto("/staff");
    const search = page.getByRole("combobox", { name: /^Scan library card/ });
    await search.fill("Everyday");
    const option = page.getByRole("option", { name: /The Design of Everyday Things/ });
    await option.getByRole("button", { name: "Confirm return of The Design of Everyday Things from Tomás Rivera" }).click();
    await expect(option).toContainText("Return confirmed");
    await option.getByRole("button", { name: /^Undo/ }).click();
    await expect(option.getByRole("button", { name: /Confirm return/ })).toBeVisible();
  });
});
