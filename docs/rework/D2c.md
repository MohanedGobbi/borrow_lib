# D2c: Phone layouts, visual consistency and the remaining critique items

Model: **Sonnet · medium**. Source: the critique in `.impeccable/critique/` (P2 "phone layouts bury
the primary action", P2 "colour and size drift", the detector findings and the minor observations).
Before you edit UI, read `DESIGN.md` and `C:/Users/gobbi/.claude/skills/impeccable/reference/craft-floor.md`.
This is a refinement, not a redesign. Mostly frontend; no backend rule changes.

**Done when:** lint, `tsc -b`, check-i18n, both builds, the backend tests and the E2E suite on both
projects all pass, and the screen checks at the end pass.

## Phone layouts (below `md`, checked at 390px)
1. **Book page:** under `md`, order it title and author, then a compact **thumbnail cover**
   (about 96px wide) beside the title instead of the 336px block, then the **availability panel**
   with the Request / Join buttons, then the copies, then the details table. On desktop the layout
   stays as it is.
2. **Profile:** the **library card with its QR code comes first**, then the account details.
   Give the card an `id="card"`.
3. **My loans:** each READY row gets a "Show my card" link to `/profile#card`, which scrolls the
   card into view.
4. **Catalog list on phones:** today it is a wall of 18 full-width outline buttons. Under `sm`,
   make the whole row the link to the book, and show availability as text with its dot. Remove the
   per-row button on phones; signed-in students can still use the existing cart or quick request
   from the book page. Keep the row button on wider screens.

## Visual consistency with DESIGN.md
5. **The library card's red bottom stripe** (`ProfilePage`, the `h-1.5 bg-danger` element): red
   means late or destructive, so make it university green or remove it. Keep whichever matches the
   card's look.
6. **Toasts:**
   - drop Sonner's `richColors`;
   - style them with system tokens: a white surface, a hairline border, the 6px radius, and a
     leading icon in green for success or red for errors;
   - **position them at the reading-direction end**: bottom-right in LTR, bottom-left in RTL.
     Switch the `Toaster` `position` from the current `dir`;
   - the Undo action uses the secondary button style.
7. **Type scale:** every off-scale size the detector found must use a DESIGN.md step:
   `text-[17px]` in `Layout.tsx:43`, `BookDetailPage.tsx:86` and `LandingPage.tsx:37`, the
   `text-[10px]` header badges in `Layout.tsx:143,158`, and `text-[11px]` / `text-[9px]` in
   `BookCover.tsx:36,40`.
   - Nothing below **11px**.
   - On the smallest covers, mark the cover's printed title and author `aria-hidden`; the real
     title sits next to it. Drop the author line at the smallest size rather than shrinking it.
   - If 17px is a deliberate "lead" size, add it to the ramp in `tailwind.config.js` and to
     DESIGN.md as `lead`, instead of leaving arbitrary values.
8. **`src/index.css:52`:** the `hsl(142 45% 85%)` colour is off the palette. Use the nearest
   token (`green-wash` / the hairline) or tie it to a CSS variable from the palette.
9. **Amber:**
   - Loans shows "due soon" in amber, but DESIGN.md reserves amber for pickup windows.
   - Either use ink with a Clock icon for due-soon, or widen the DESIGN.md rule to "deadlines
     within 48h" and apply it consistently. **Pick one and update DESIGN.md if the rule changes.**

## Loading
10. **List pages:** they show a full-page loader while data loads. Inside the app shell, show the
    `PageHeader` immediately and put a quiet loader (or 3–5 skeleton rows using the hairline
    style) in the panel. Keep `FullPageLoader` only for route-chunk `Suspense` and the initial
    session check.

## Minor observations from the critique
11. **Landing:**
    - only **one filled green button** in the first screen; the header "Create account" becomes
      the outline or secondary style;
    - the staff paragraph is limited to about 65ch (`max-w-prose`);
    - the "How borrowing works" aside should not look like a card inside a card: drop its border
      or its background, whichever reads cleaner on the surface band.
12. **Footer:** align it with the staff shell on staff pages, so it starts at the same inset as
    the sidebar, or use the full width under the shell. It must not be centred at 1280px while the
    shell is 1440px.
13. **Inventory filter placeholder** is cut off ("…or she"). Shorten it ("Title, author, ISBN,
    shelf mark") or widen the field.
14. **Mobile Overview "needs attention" rows** truncate the title while the meta line wraps. Pick
    one behaviour: allow the title to wrap to 2 lines, and clamp after that.
15. **Members list:** hide the "0 / 10" loan limit for staff and admin accounts. They can't borrow.
16. **Analytics "Fulfillment rate":** add a short definition under the value, through `t()`:
    "Share of requests that became loans".
17. **Sidebar:** the "Staff desk" header nav item and the sidebar stay highlighted on `/scan/...`.
18. **Arabic:** category names stay as data; no change.

## Screen check
Re-capture the critique screenshots to verify, at 1440 and 390, in EN and AR. A one-off Playwright
script is fine (see how `e2e/fixtures.ts` signs in). Put it in your scratch space, not in the repo.
- Look at: book page (phone), profile (phone), My loans (phone), catalog (phone), the toast in AR
  (trigger one), landing (desktop), Members, Analytics.
- Confirm each numbered item above. Fix what is off in one batch, then confirm once more; don't
  loop.

## Report
- files changed;
- the decision you took on 5, 7 (lead size), 9 and 12, with a sentence each;
- check and E2E results;
- what you verified on the screenshots.
