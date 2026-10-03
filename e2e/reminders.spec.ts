import { expect, test } from "@playwright/test";
import { expectToast, latestEmail, rowWith, signIn, STAFF } from "./fixtures";

// Tomás (a French-speaking member) has a pending request for The Pragmatic Programmer, which has a free copy.
// No other spec touches his account or that book.
const MEMBER = "tomas@example.com";
const MEMBER_NAME = "Tomás Rivera";
const BOOK = "The Pragmatic Programmer";

test.describe("email reminders", () => {
  test("approving a request emails the member that the book is ready for pickup", async ({ page }, testInfo) => {
    await signIn(page, STAFF);
    await page.goto("/staff/approvals");
    await rowWith(page, MEMBER_NAME, BOOK).getByRole("button", { name: "Approve" }).click();
    await expectToast(page, "Approved");

    const { subject, body } = await latestEmail(page, testInfo.project.name, MEMBER);
    // In the member's language (French), with the title and the way to My loans.
    expect(subject).toContain(BOOK);
    expect(subject).toContain("prêt à être retiré");
    expect(body).toContain(BOOK);
    expect(body).toMatch(/Cote : TEC-C-02/);
    expect(body).toMatch(/avant le \d{1,2} \p{L}+ \d{4}, \d{2}:\d{2}/u);
    expect(body).toMatch(/https?:\/\/\S+\/my-requests/);
  });
});
