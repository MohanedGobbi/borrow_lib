import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";

/** Every seeded account (backend seed_demo, mirrored in src/api/demo.ts) uses this password. */
export const PASSWORD = "password123";

export const STAFF = "staff@libborrow.dev";

const mailDir = path.join(path.dirname(fileURLToPath(import.meta.url)), ".mail");

/** Signs in through the normal form, so both projects run the same code (no demo one-click buttons). */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
}

/** A toast (the app's transient messages), found by its text. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(toast(page, text).first()).toBeVisible();
}

/** Opens a book's detail page by searching the catalog for its title. */
export async function openBook(page: Page, title: string) {
  await page.goto(`/catalog?q=${encodeURIComponent(title)}`);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** A table row (or list item) of the current page, found by text that all appear in it. */
export function rowWith(page: Page, ...texts: string[]): Locator {
  let rows = page.getByRole("row");
  for (const text of texts) rows = rows.filter({ hasText: text });
  return rows;
}

/** Opens the notification bell and returns the list of messages. */
export async function openNotifications(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * The newest link in an email sent to `to` that matches `pattern`.
 * Django (project "django"): the file-based mail backend writes each message to e2e/.mail.
 * Demo: the in-browser mailbox page lists what the demo "sent".
 */
export async function latestEmailLink(page: Page, project: string, to: string, pattern: RegExp): Promise<string> {
  if (project === "demo") {
    await page.goto("/demo/mailbox");
    const mail = page.locator("section").filter({ hasText: to }).filter({ has: page.getByRole("link", { name: "Open the link in the message" }) });
    await expect(mail.first()).toBeVisible();
    const href = await mail.first().getByRole("link", { name: "Open the link in the message" }).getAttribute("href");
    expect(href).toMatch(pattern);
    return href!;
  }

  let found = "";
  await expect.poll(() => {
    found = findLinkInMailDir(to, pattern) ?? "";
    return found;
  }, { message: `an email to ${to} with a link matching ${pattern}` }).not.toBe("");
  return found;
}

/**
 * The newest email sent to `to`: its subject and body text.
 * Same two sources as latestEmailLink. The demo mailbox lists newest first; for Django the newest file wins.
 */
export async function latestEmail(page: Page, project: string, to: string): Promise<{ subject: string; body: string }> {
  if (project === "demo") {
    await page.goto("/demo/mailbox");
    const mail = page.locator("section").filter({ hasText: to }).first();
    await expect(mail).toBeVisible();
    return { subject: (await mail.locator("h2").innerText()).trim(), body: await mail.locator("pre").innerText() };
  }

  let found: { subject: string; body: string } | null = null;
  await expect.poll(() => {
    found = findMessageInMailDir(to);
    return found !== null;
  }, { message: `an email to ${to}` }).toBe(true);
  return found!;
}

function findMessageInMailDir(to: string): { subject: string; body: string } | null {
  let files: string[];
  try {
    files = readdirSync(mailDir).map((name) => path.join(mailDir, name));
  } catch {
    return null;
  }
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || b.localeCompare(a));
  for (const file of files) {
    const message = decodeMessage(readFileSync(file, "utf8"));
    if (!new RegExp(`^To:.*${to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "mi").test(message.headers)) continue;
    const subject = /^Subject:[ \t]*(.*(?:\r?\n[ \t]+.*)*)/im.exec(message.headers)?.[1] ?? "";
    return { subject: decodeHeader(subject), body: message.body };
  }
  return null;
}

/** Undoes RFC 2047 encoded words ("=?utf-8?b?...?=") in a header, which Django uses for non-ASCII subjects. */
function decodeHeader(value: string): string {
  return value
    .replace(/\r?\n[ \t]+/g, " ")
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?utf-8\?([bq])\?(.*?)\?=/gi, (_, kind: string, text: string) =>
      kind.toLowerCase() === "b"
        ? Buffer.from(text, "base64").toString("utf8")
        : Buffer.from(
          text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16))),
          "latin1",
        ).toString("utf8"));
}

function findLinkInMailDir(to: string, pattern: RegExp): string | null {
  let files: string[];
  try {
    files = readdirSync(mailDir).map((name) => path.join(mailDir, name));
  } catch {
    return null;
  }
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const file of files) {
    const message = decodeMessage(readFileSync(file, "utf8"));
    if (!new RegExp(`^To:.*${to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "mi").test(message.headers)) continue;
    const link = message.body.match(new RegExp(`https?://\\S*${pattern.source}`));
    if (link) return link[0];
  }
  return null;
}

/** Splits a raw message and undoes its transfer encoding, so the link is readable whatever Django chose. */
function decodeMessage(raw: string): { headers: string; body: string } {
  const [headers, ...rest] = raw.split(/\r?\n\r?\n/);
  let body = rest.join("\n\n");
  const encoding = /^Content-Transfer-Encoding:\s*(\S+)/im.exec(headers)?.[1]?.toLowerCase();
  if (encoding === "base64") body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  else if (encoding === "quoted-printable") {
    body = body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }
  return { headers, body };
}
