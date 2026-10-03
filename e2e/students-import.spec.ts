import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { latestEmail, rowWith, signIn, STAFF } from "./fixtures";

const ADMIN = "admin@libborrow.dev";
// Two new students for the admin's import. Used by this spec only.
const FIRST = "e2e.nadia@univ.example";
const SECOND = "e2e.omar@univ.example";

test.describe("exports and student import", () => {
  test("the admin imports two students and the first gets a welcome email", async ({ page }, testInfo) => {
    const file = testInfo.outputPath("students.csv");
    writeFileSync(file, `name,email,student_id\nNadia Salem,${FIRST},E2E-0001\nOmar Ben Ali,${SECOND},E2E-0002\n`);

    await signIn(page, ADMIN);
    await page.goto("/staff/users");
    await page.getByRole("link", { name: "Import students" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Import students" })).toBeVisible();

    await page.getByLabel("Choose a file").setInputFiles(file);
    // The preview shows both rows as new accounts and saves nothing yet.
    await expect(page.getByRole("button", { name: "Create 2 accounts" })).toBeEnabled();
    await expect(rowWith(page, FIRST, "E2E-0001", "New")).toBeVisible();
    await expect(rowWith(page, SECOND, "E2E-0002", "New")).toBeVisible();

    await page.getByRole("button", { name: "Create 2 accounts" }).click();
    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
    await expect(page.getByText("2 accounts created and 2 welcome emails sent.").first()).toBeVisible();

    const mail = await latestEmail(page, testInfo.project.name, FIRST);
    expect(mail.subject).toContain("account is ready");
    expect(mail.body).toMatch(/\/reset-password\?uid=\S+&token=\S+/);
    expect(mail.body).toContain("Forgot password?");

    // Importing the same file again leaves both alone: they already have an account.
    await page.goto("/staff/users/import");
    await page.getByLabel("Choose a file").setInputFiles(file);
    await expect(page.getByText("Nothing to import.")).toBeVisible();
    await expect(rowWith(page, FIRST, "Has an account")).toBeVisible();
  });

  test("staff export the catalogue as CSV", async ({ page }, testInfo) => {
    await signIn(page, STAFF);
    await page.goto("/staff/inventory");

    const downloading = page.waitForEvent("download");
    if (testInfo.project.name === "demo") {
      // The demo build cannot write Excel files: a single CSV button.
      await page.getByRole("button", { name: "Export CSV" }).click();
    } else {
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("menuitem", { name: "CSV file (.csv)" }).click();
    }
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^libborrow-books-\d{4}-\d{2}-\d{2}\.csv$/);

    const text = readFileSync(await download.path(), "utf8");
    const [header, first] = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    expect(header).toContain("isbn,title,author");
    expect(first).toContain("978"); // a catalogue row follows the header
  });
});
