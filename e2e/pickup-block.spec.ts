import { expect, test } from "@playwright/test";
import { expectToast, rowWith, signIn, STAFF } from "./fixtures";

// Daniel has a READY hold on "Thinking, Fast and Slow" and an overdue loan of "The Name of the Wind".
// The owner's rule: an overdue loan also blocks picking up a hold. Read-only: nothing is confirmed.
const HOLD = "Thinking, Fast and Slow";
const REASON = "Return “The Name of the Wind” first";

test.describe("an overdue loan blocks a pickup", () => {
  test("staff see Confirm pickup disabled, with the book to return first", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/pickups");
    const row = rowWith(page, "Daniel Okafor", HOLD);
    const confirm = row.getByRole("button", { name: "Confirm pickup" });

    await expect(confirm).toHaveAttribute("aria-disabled", "true");
    await expect(confirm).toHaveAccessibleDescription(REASON);
    await expect(row).toContainText(REASON); // visible text too, a tooltip is not reachable on a phone
    await expect(row).toContainText("Overdue, requests blocked");

    await confirm.hover();
    await expect(page.getByRole("tooltip").first()).toContainText(REASON);

    // Clicking starts nothing: no Undo window, no toast.
    await confirm.click({ force: true }); // aria-disabled, so Playwright does not see it as enabled
    await expect(row.getByRole("button", { name: "Undo" })).toHaveCount(0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

    // A member in good standing is unaffected.
    await expect(rowWith(page, "Priya Sharma", "Sapiens").getByRole("button", { name: "Confirm pickup" }))
      .not.toHaveAttribute("aria-disabled", "true");
  });

  test("the P key says why instead of confirming a blocked pickup", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff/pickups");
    await rowWith(page, "Daniel Okafor", HOLD).focus();
    await page.keyboard.press("p");
    await expectToast(page, REASON);
    await expect(rowWith(page, "Daniel Okafor", HOLD).getByRole("button", { name: "Undo" })).toHaveCount(0);
  });

  test("the staff overview and the member's workstation show the same block", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff");
    const urgent = page.getByRole("listitem").filter({ hasText: HOLD });
    await expect(urgent.getByRole("button", { name: "Confirm pickup" })).toHaveAttribute("aria-disabled", "true");
    await expect(urgent).toContainText(REASON);

    await page.getByRole("link", { name: "Daniel Okafor" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Daniel Okafor" })).toBeVisible();
    const hold = page.getByRole("listitem").filter({ hasText: HOLD });
    await expect(hold.getByRole("button", { name: "Confirm pickup" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("alert")).toContainText("pickups are blocked");
  });

  test("the student sees it under the hold on My loans", async ({ page }) => {
    await signIn(page, "daniel@example.com");
    await page.goto("/my-requests");
    const hold = page.getByRole("listitem").filter({ hasText: HOLD });
    await expect(hold).toContainText("Ready for pickup");
    await expect(hold).toContainText("Return “The Name of the Wind” before you can collect this");
  });
});
