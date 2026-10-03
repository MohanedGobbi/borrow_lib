import { expect, test } from "@playwright/test";
import { openBook, signIn } from "./fixtures";

// Daniel has an overdue loan (The Name of the Wind), so he cannot request anything new.
// The page says so before the click: the Request button is guarded, with the book he has to return.
const REASON = "Return “The Name of the Wind” to request again";

test.describe("overdue block", () => {
  test("a member with an overdue loan is stopped before a request that would fail", async ({ page }) => {
    await signIn(page, "daniel@example.com");
    await openBook(page, "Atomic Habits");

    // A slim notice at the top, linking to My loans.
    const notice = page.getByRole("alert").filter({ hasText: "You have an overdue loan" });
    await expect(notice).toContainText("The Name of the Wind");
    await expect(notice.getByRole("link", { name: "View my loans" })).toHaveAttribute("href", "/my-requests");

    const request = page.getByRole("button", { name: "Request this book" });
    await expect(request).toHaveAttribute("aria-disabled", "true");
    await expect(request).toHaveAccessibleDescription(REASON);
    await request.hover();
    await expect(page.getByRole("tooltip")).toContainText(REASON);

    // Clicking does nothing: no request is sent, so no error toast either.
    await request.click({ force: true }); // aria-disabled, so Playwright does not see it as enabled
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

    // The catalog rows are guarded the same way.
    await page.goto("/catalog?q=Atomic");
    await expect(page.getByRole("button", { name: "Request", exact: true }).first()).toHaveAttribute("aria-disabled", "true");

    await page.goto("/my-requests");
    await expect(page.getByText("New requests are blocked")).toBeVisible();
    await expect(page.getByRole("link", { name: "Atomic Habits" })).toHaveCount(0);
  });
});
