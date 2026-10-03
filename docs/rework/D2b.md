# D2b: Student control, Arabic correctness, translated activity, copy privacy

Model: **Sonnet · high**. Source: the design critique in `.impeccable/critique/` (P1 "students have
no control" and P1 "three Arabic bugs", plus the P2 public-overdue leak). Before you edit UI, read
`DESIGN.md` and `C:/Users/gobbi/.claude/skills/impeccable/reference/craft-floor.md`.
This is a refinement of the existing visual system, not a redesign.

**Done when:**
- the new backend tests below pass with the rest;
- `makemigrations --check`, lint, `tsc -b`, check-i18n and both builds pass;
- the E2E suite passes on both projects, including the new specs below;
- the browser checks pass.

## 1. Students can take a request back (backend + UI)
- **New transition `withdraw`, allowed from PENDING and READY, by the record's owner only.**
  - The record becomes `CANCELLED`, and `cancelled_by_member` is set: add the field,
    `BooleanField(default=False)`, with a migration.
  - **Stock never changes.** A READY hold never took a copy off the shelf.
  - **Withdrawing a READY hold frees the copy, so call `_hand_to_queue`** with the book row locked,
    exactly as the expiry job does. The next student in the queue gets the hold.
  - Log `REQUEST_WITHDRAWN`. No notification is needed, since the member did it.
  - Endpoint: `POST /api/borrow-records/<id>/withdraw`. Someone who isn't the owner gets a
    403 `forbidden`; staff use Reject instead. Any other state gets a 409 `invalid_transition`.
- **Leave a waiting list:** `DELETE /api/reservations/<id>`, owner only, sets `is_active=False`
  and returns 204. The positions of the others shift automatically.
- **Mirror both in `demo.ts`.**
- **Tests (`test_student_control.py`):**
  - withdraw from PENDING;
  - withdraw from READY with a queue (the next member gets READY, and stock is unchanged);
  - withdraw from READY without a queue (the copy becomes free);
  - another member gets 403, a BORROWED record gets 409;
  - leaving a list removes you, the person behind moves up, and another member can't remove you.
- **UI in My loans:**
  - "Cancel request" on PENDING rows; "I no longer need it" on READY rows;
  - "Leave waiting list" on waiting-list rows;
  - each opens a small `AlertDialog` that names the book. For READY it says the copy goes to the
    next student.
  - Invalidate through the `qk` helpers.
- **The book page after an action:** replace the toast-only feedback with an inline confirmation
  in the availability panel (the toast can stay):
  - after Request: "Requested. We'll notify you when a copy is set aside for you; you'll then
    have 48 hours to collect it at the desk." with a link to My loans;
  - after joining a waiting list: "You're #{position} in line. When a copy comes back it's held
    for the first person in line for 48 hours." Use the position from the API response.
- **The overdue banner** (My loans, and wherever else it appears) gives a way forward:
  "Return it at the circulation desk. New requests unlock as soon as it's checked in."
  Do **not** invent opening hours.

## 2. Arabic correctness
- **Countdown order:** `src/components/Countdown.tsx` / `src/lib/time.ts` force `dir="ltr"`
  around unit strings, so "1d 15h" reads backwards in Arabic. Keep `dir="ltr"` only for the
  digits-only `HH:MM:SS` form, and let unit strings (`Intl` narrow units, or the existing `t()`
  units) follow the page direction. Check that Arabic now reads days before hours.
- **Activity log in the reader's language:**
  - add `ActivityLog.code` and `ActivityLog.params` (JSON), with a migration, as WP-09 did for
    notifications;
  - give every `log_activity(...)` call a code and params (actor, member, title, counts, …), and
    keep the English `detail`;
  - the serializer exposes `code` and `params`;
  - `ActivityPage` and the Overview activity panel render `t("activity.<code>", params)` and fall
    back to `detail`;
  - extend the existing "every code is translated" backend test to `activity.*`;
  - mirror in `demo.ts`.
- **`dir="auto"`** on content text that can be in any language: book titles and descriptions,
  author names, member names in lists, the activity fallback text, the notification fallback text
  and rejection reasons. Shelf marks, ISBNs and IDs stay `dir="ltr"`.

## 3. Public copy privacy
`GET /books/<id>/copies` for anyone who isn't staff:
- report OVERDUE copies as `BORROWED`, and without a `dueDate`;
- the UI then shows "On loan · back soon" instead of a past date in red.

Staff still see `OVERDUE` with dates and names. Test both, and mirror in `demo.ts`.

## E2E
Add `e2e/student-control.spec.ts`:
- a member requests a book, then cancels it from My loans. Check the request is gone and the
  book's free count is back;
- a member joins a waiting list, sees "#N in line" inline, then leaves it from My loans.

Use books and accounts the other specs don't touch.

## Browser checks (demo)
1. **Arabic, as Priya:** the READY countdown on My loans reads days before hours; the Overview
   activity panel (as Marcus) is in Arabic.
2. **Withdraw a READY hold for a book with a queue** (any seeded one): the next member's My loans
   shows the hold.
3. **Anonymous visitor, a book with an overdue copy:** no red "Overdue" shown.

## Report
- files changed;
- test and E2E results;
- what you verified in the browser;
- any deviations, with your reasoning.
