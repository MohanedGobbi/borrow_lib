import { expect, test } from "@playwright/test";
import { latestEmailLink, PASSWORD, signIn } from "./fixtures";

// Omar resets his password. Used by this spec only.
const MEMBER = "omar@example.com";
const NEW_PASSWORD = "a-new-passphrase-2026";

test.describe("password reset", () => {
  test("reset through the emailed link, then sign in with the new password", async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    // The sign-in form also has an Email field, so wait for the reset form before filling it in.
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email").fill(MEMBER);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists for this address")).toBeVisible();

    const link = await latestEmailLink(page, testInfo.project.name, MEMBER, /\/reset-password\?uid=\S+&token=\S+/);
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

    // The old password no longer works; the new one does.
    await page.goto("/login");
    await page.getByLabel("Email").fill(MEMBER);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Incorrect email or password");

    await signIn(page, MEMBER, NEW_PASSWORD);
  });
});
