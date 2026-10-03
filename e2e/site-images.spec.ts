import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectToast, signIn } from "./fixtures";

const ADMIN = "admin@libborrow.dev";
const HERO_ALT = "E2E reading room at dusk";

/** A plain PNG of the given size, drawn on a canvas inside the page and written to the test's output folder. */
async function makePng(page: Page, path: string, width: number, height: number) {
  const base64 = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#0e6b3c");
    gradient.addColorStop(1, "#f2c14e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { w: width, h: height });
  writeFileSync(path, Buffer.from(base64, "base64"));
}

/** The Settings row for one photograph (its `li`), found by the name of the place it appears. */
const photoRow = (page: Page, place: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: place }) });

/** Puts the landing hero back to the bundled photograph, whatever state a failed run left it in. */
async function restoreHero(page: Page) {
  await page.goto("/staff/settings");
  const row = photoRow(page, "Landing page, top");
  await expect(row).toBeVisible();
  const restore = row.getByRole("button", { name: "Restore default" });
  if (await restore.isVisible()) {
    await restore.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore original" }).click();
    await expectToast(page, "Original photograph restored.");
  }
}

test.describe("site photos", () => {
  test("the admin replaces the hero photograph, sees it on the landing page, then restores the original", async ({ page }, testInfo) => {
    const file = testInfo.outputPath("hero.png");
    await page.goto("/");
    await makePng(page, file, 1600, 1000);

    await signIn(page, ADMIN);
    try {
      await page.goto("/staff/settings");
      await expect(page.getByRole("heading", { level: 2, name: "Site photos" })).toBeVisible();
      const row = photoRow(page, "Landing page, top");
      await expect(row.getByText("Original photograph")).toBeVisible();
      await expect(row.getByRole("button", { name: "Restore default" })).toHaveCount(0);

      await row.getByRole("button", { name: "Replace photo" }).click();
      const dialog = page.getByRole("dialog", { name: /Replace photo: Landing page, top/ });
      await dialog.getByLabel("Photograph", { exact: true }).setInputFiles(file);
      await expect(dialog.getByAltText("Preview of the chosen photograph")).toBeVisible();

      // The photograph is not decorative: all three descriptions are needed before it can be uploaded.
      const upload = dialog.getByRole("button", { name: "Upload photograph" });
      await expect(upload).toBeDisabled();
      await dialog.getByLabel("Description in English").fill(HERO_ALT);
      await dialog.getByLabel("Description in French").fill("Salle de lecture au crépuscule");
      await expect(upload).toBeDisabled();
      await dialog.getByLabel("Description in Arabic").fill("قاعة قراءة عند الغروب");
      await dialog.getByLabel("Credit (optional)").fill("Photo: E2E archives");
      await expect(upload).toBeEnabled();
      await upload.click();

      await expectToast(page, "Photograph replaced.");
      await expect(dialog).toBeHidden();
      await expect(row.getByText(/^Replaced /)).toBeVisible();
      await expect(row.getByText(/Credit: .*Photo: E2E archives/)).toBeVisible();

      // The landing hero now shows the uploaded photograph, with its description, and the footer carries the credit.
      await page.goto("/");
      const hero = page.getByRole("img", { name: HERO_ALT });
      await expect(hero).toBeAttached();
      await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await hero.getAttribute("src")).not.toContain("zurich");
      expect(await hero.getAttribute("srcset")).not.toContain("zurich");
      // The responsive candidates survive the trip: 640 and 1200 at least, and `src` is the 1200 file.
      const candidates = ((await hero.getAttribute("srcset")) ?? "").split(/,\s+/).map((c) => c.split(" "));
      expect(candidates.map(([, width]) => width).slice(0, 2)).toEqual(["640w", "1200w"]);
      expect(await hero.getAttribute("src")).toBe(candidates[1][0]);
      await expect(page.getByRole("contentinfo").getByText("Photo: E2E archives")).toBeVisible();
      // The other two photographs are still the bundled ones.
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "Tat Linh Nguyen" })).toBeVisible();

      // Restore the original.
      await page.goto("/staff/settings");
      await row.getByRole("button", { name: "Restore default" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Restore original" }).click();
      await expectToast(page, "Original photograph restored.");
      await expect(row.getByText("Original photograph")).toBeVisible();

      await page.goto("/");
      await expect(page.getByRole("img", { name: HERO_ALT })).toHaveCount(0);
      await expect(page.locator("picture img[src*='zurich']").first()).toBeAttached();
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "Ilia Bronskiy" })).toBeVisible();
    } finally {
      await restoreHero(page); // the Django project shares this state with every other spec
    }
  });

  test("a photograph that is too narrow is refused before it is uploaded", async ({ page }, testInfo) => {
    const file = testInfo.outputPath("narrow.png");
    await page.goto("/");
    await makePng(page, file, 800, 500);

    await signIn(page, ADMIN);
    await page.goto("/staff/settings");
    await photoRow(page, "Landing page, top").getByRole("button", { name: "Replace photo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Photograph", { exact: true }).setInputFiles(file);
    await expect(dialog.getByRole("alert").filter({ hasText: "at least 1200 pixels wide" })).toBeVisible();
    await dialog.getByLabel("Description in English").fill("x");
    await dialog.getByLabel("Description in French").fill("x");
    await dialog.getByLabel("Description in Arabic").fill("x");
    await expect(dialog.getByRole("button", { name: "Upload photograph" })).toBeDisabled();
  });
});
