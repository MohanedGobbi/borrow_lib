import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openBook, signIn, STAFF } from "./fixtures";

/**
 * Axe on the main screens. Only `critical` violations fail the run; `serious` ones are collected
 * into e2e/a11y-report.md as the starting list for the accessibility pass (WP-24).
 */
interface Finding { rule: string; page: string; count: number; help: string }
const serious: Finding[] = [];

/** Axe help text mentions tags such as <dl>; keep them literal inside a Markdown table cell. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/<(\w+)>/g, "`<$1>`");

async function audit(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  for (const v of violations) {
    if (v.impact === "serious") serious.push({ rule: v.id, page: name, count: v.nodes.length, help: v.help });
  }
  const critical = violations.filter((v) => v.impact === "critical");
  expect(
    critical.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
    `critical accessibility violations on ${name}`,
  ).toEqual([]);
}

test.describe("accessibility", () => {
  test.afterAll(() => {
    // Both projects render the same screens, so one report is enough; the demo run writes it.
    if (test.info().project.name !== "demo") return;
    const rows = [...serious].sort((a, b) => a.rule.localeCompare(b.rule) || a.page.localeCompare(b.page));
    const lines = [
      "# Accessibility report: serious axe violations",
      "",
      "Written by `e2e/a11y.spec.ts` (demo project) as input for WP-24. Critical violations fail the test run instead.",
      "Count is the number of elements on that page that break the rule.",
      "",
      "| Rule | Page | Count | What it means |",
      "|---|---|---|---|",
      ...(rows.length ? rows.map((r) => `| \`${r.rule}\` | ${r.page} | ${r.count} | ${cell(r.help)} |`) : ["| none | | | |"]),
      "",
    ];
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "a11y-report.md");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, lines.join("\n"));
  });

  test("landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await audit(page, "Landing");
  });

  test("catalog", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page.getByRole("link", { name: "Dune", exact: true })).toBeVisible();
    await audit(page, "Catalog");
  });

  test("book detail", async ({ page }) => {
    await openBook(page, "Dune");
    await audit(page, "Book detail");
  });

  test("sign in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await audit(page, "Sign in");
  });

  test("my requests (member)", async ({ page }) => {
    await signIn(page, "priya@example.com");
    await page.goto("/my-requests");
    await expect(page.getByRole("heading", { level: 1, name: "My loans and requests" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "The Selfish Gene" })).toBeVisible();
    await audit(page, "My requests");
  });

  test("staff overview", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("Pending approvals").first()).toBeVisible();
    await audit(page, "Staff overview");
  });
});
