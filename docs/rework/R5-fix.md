# R5 fix batch: the finish reviewer's material fixes

Model: **Sonnet · high**. The independent finish reviewer returned **fix**. Apply items 1–6 below
**in one batch**, then recapture the same screenshots. Item 7 (the DESIGN.md rewrite) is done by the
documenter afterwards; do not touch DESIGN.md.

Read the craft floor (`C:/Users/gobbi/.claude/skills/impeccable/reference/craft-floor.md`) and the
contract (`/c/Users/gobbi/.claude/skills/impeccable/scripts/impeccable surface-brief read src/App.tsx`)
first. The reviewer's "keep" applies: **keep the landing hero exactly as it is**, keep the single
green, and add no colour, ornament or effects.

1. **Covers: drop the fake cloth bindings.** Rework `src/components/BookCover.tsx`:
   - **When there's no uploaded cover image,** render a **flat typographic plate in the palette**:
     a white or surface (`#F5F7F6`) ground, a 1px hairline frame, the title in the serif display
     face, the author in Public Sans, and an optional small "University Library" foot line at
     large sizes.
   - Remove the spine hinge, the tooled frame, the object shadow and **every off-palette cloth
     colour**. Stop using `coverColor` for the fill; keep the field in the API and leave it unused.
     **No maroon or other red-adjacent fills.**
   - Uploaded `coverImage` still replaces the plate at the same geometry.
   - **Catalog rows:** drop the coloured block when there's no cover image. Use either a small
     plate in the same language or no thumbnail at all, whichever reads better in the list. Decide
     on the screenshot.
   - **Phone book page (item 6):** at the `hero` size below `md`, render the plate **without its
     title**, because the H1 sits beside it. A quiet plate with only the hairline frame and the
     foot line is fine.
   - Don't download any cover art.
2. **Catalog gets the public identity.** The owner put it on the bold public side.
   - A **display-scale serif title**, as on the landing's section headings.
   - The search uses the landing's large white-field treatment.
   - **Remove the coloured category dots;** the category becomes a text label only. Category
     colours elsewhere in staff UI can stay for now.
   - **Signed out:** replace the per-row "Sign in to request" buttons with **one** sign-in note
     near the top ("Sign in to request books", with a primary Sign in button), and rows without a
     button. Signed-in rows keep their guarded Request buttons.
   - Keep pagination, filters, URL state and "Clear filters".
3. **Every site photo is black and white** (the owner's request).
   - **Backend:** in `backend/library/site_images.py`, convert to greyscale with
     `ImageOps.grayscale(...).convert("RGB")` after `exif_transpose` and before re-encoding, for
     every slot. Add a test asserting the stored WebPs are greyscale (for example, every pixel has
     R == G == B, or the band extrema match).
   - **Demo:** do the same in the canvas resize in `src/api/demo.ts`.
   - Remove the now-redundant `grayscale` CSS on the auth slot, so all slots render the stored
     pixels.
   - The admin preview in `SitePhotosSection` shows greyscale for the local preview too, with a
     one-line note under the picker: "Photos are shown in black and white".
4. **Book page kicker.** Delete the 13px muted "Availability" h2 directly above the "On the shelf
   now" serif heading (`BookDetailPage.tsx`, about line 101). Make the status heading the h2, and
   keep the accessible structure.
5. **My loans and Overview: one grid.**
   - **My loans "Current" panel:** the time/status column starts at three different x positions,
     and the action groups don't align. Put the rows on **one shared grid template**, using CSS
     grid columns on the list with each row a subgrid or the same template, so the columns line up
     whether a row has 1, 2 or 3 actions.
   - **Staff Overview "Needs attention":** the countdowns sit at different x positions. Align them
     the same way.
   - Check both at 1440 and 390 (phones stack as now).
6. Covered in item 1.

## Checks
All must pass:
- backend tests (plus the new greyscale test);
- `makemigrations --check`;
- lint, `tsc -b`, check-i18n;
- both builds;
- the full E2E suite on both projects. If a selector relied on the removed per-row "Sign in to
  request", update the spec and list it.

## Recapture (the same files the reviewer judged)
Overwrite them in `D:\Projects\lib_borrow\.impeccable\review\`, using the same viewports, demo
build, reduced motion and full page:
- `desktop.png` (landing 1440) and `mobile.png` (landing 390);
- `landing-ar-1440.png`;
- `catalog-1440.png`;
- `book-1440.png` and `book-390.png`;
- `signin-1440.png`;
- `myloans-1440.png` (priya@example.com);
- `profile-390.png` (priya);
- `overview-1440.png` and `approvals-1440.png` (staff@libborrow.dev);
- one extra, `catalog-390.png`.

Password: `password123`, localhost demo only. Use a one-off Playwright script: a temporary copy under
`e2e/`, deleted afterwards. Run it against a demo server you start on port 4390, and stop it by PID.
Before you finish, open every capture and confirm it shows what its name says.

**Process hygiene:** never kill by image name; never use `git worktree`.

## Report
- the changes per item;
- the decision on catalog thumbnails;
- check and E2E results;
- confirmation that the 12 captures were refreshed and validated.
