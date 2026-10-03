# D2a: Desk safety and a scan-first circulation desk

Model: **Sonnet · high**. Source: the design critique at
`.impeccable/critique/2026-10-03T00-15-53Z__src-app-tsx.md`. Read it first, then `DESIGN.md`,
then `C:/Users/gobbi/.claude/skills/impeccable/reference/craft-floor.md` before you edit any UI.

**Refinement, not redesign.** Keep the current visual system: green / white / red, the hairlines,
Public Sans, Lucide, and the shared `PageHeader`, `Panel` and table classes. Staff Overview
keeps its structure; the owner declined the "desk home = scan field" rethink.

**Done when:**
- backend tests (new ones listed below), lint, `tsc -b`, check-i18n and both builds pass;
- the E2E suite passes on both projects;
- the browser checks at the end pass.

You may update E2E specs only where this WP changes the UI on purpose: a confirmation dialog
now sits before delete or reject, and a button's accessible name changed. Say which in the report.

## 1. Irreversible actions (P0)

**Delete book (Inventory):**
- an `AlertDialog` naming the book, with "Delete book" as the destructive button and Cancel as
  the default focus;
- the bin icon is neutral (`text-muted-foreground`) and turns red only on hover or focus;
- when deletion is impossible (copies on loan), use `aria-disabled` with a visible tooltip
  explaining why, instead of only a faded red.

**Reject:**
- an `AlertDialog` with an optional reason (textarea, max 300 characters) and "Reject request" as
  the destructive button.
- Backend:
  - add `BorrowRecord.rejection_reason` (`CharField`, blank, 300) with a migration;
  - `reject(staff, record, reason="")` stores it;
  - the `request_rejected` notification gets a `reason` param, and `notif.request_rejected_reason`
    is used when a reason exists;
  - the serializer exposes `rejectionReason`.
- My requests shows the reason under a rejected row.

**Confirm pickup and Confirm return get an 8-second Undo.** Use a deferred commit; no backend
undo is needed.
- The click marks the row "Pickup confirmed · Undo" (or "Return confirmed · Undo") and shows a
  toast with an **Undo** action. The API call is sent when the 8 seconds end.
- Undo cancels the timer, and nothing is sent.
- **Flush right away** (send the call immediately) when:
  - the page unmounts (route change);
  - on `pagehide`, using `fetch` with `keepalive: true`, so the Authorization header still goes;
  - the same row receives a second action.
- Put this in one hook, `src/hooks/useDeferredAction.ts`, used by Pickups, Loans, Overview's
  needs-attention rows and the member workstation.
- After the real call succeeds, invalidate through `invalidateCirculation`. If it fails, show the
  error with `errorMessage` and put the row back.
- Demo mode works the same way, because the call goes through the same API functions.

## 2. Scan-first desk (P1)

**Desk search** (new `src/components/DeskSearch.tsx`, at the top of the staff main area in
`StaffLayout`, on every staff page):
- Placeholder: "Scan library card or search member, ISBN, shelf mark". `/` focuses it from
  anywhere in the staff desk, unless the user is typing in another field.
- **A scanned card:** input containing `/scan/<uuid>` or a bare UUID goes straight to that member's
  workstation on Enter. Keyboard-wedge scanners type the QR's URL and press Enter.
- **Anything else:** a combobox with debounced results in two groups:
  - **Members:** up to 5, from the users search;
  - **Books:** up to 5, from the books search, which already matches shelf marks.

  Arrow keys, Enter and Escape work, and it follows the ARIA combobox pattern. Choosing a member
  opens their workstation; choosing a book opens the book page.

**Member workstation:** a new shared component, `src/components/MemberDesk.tsx`, used by
`ScanLookupPage` (`/scan/:uuid`) and at the top of `UserDetailPage`. Contents:
- the member's name, ID, `MemberStanding`, active loans against the limit, and any block;
- **Ready for pickup** holds, each with Confirm pickup (deferred) and its countdown;
- **On loan**, with due date or days overdue, and Confirm return (deferred);
- **Pending requests**, with Approve and Reject (with the dialog);
- a link to the full history (on the scan page) or the history below (on the detail page).

Every action is reachable by Tab, in a sensible order. The backend scan endpoint already returns
the active records; extend it only if something is missing.

**Queue filters:**
- A filter input on the Approvals, Pickups and Loans panels.
- Backend: add `search` to `BorrowRecordFilter`. It matches member first or last name, student ID,
  book title, ISBN and shelf mark.
- Mirror it in `demo.ts`, and add a backend test for it.

**Approvals rows:**
- show the book's **free copies** ("2 free" / "No free copy") and the member's standing (an icon
  plus a word when blocked or at the limit);
- turn Approve into a disabled button with a reason when the book has no free copy;
- backend: `BorrowRecordSerializer` gains `bookFreeCopies`, annotated in the list view with no
  N+1 (assert the query count in a test), plus `memberHasOverdue` and `memberActiveLoans`;
- requested time shows absolute plus relative ("3 Oct, 09:12 · 2 days ago"), through `src/lib/time.ts`;
- oldest first.

**Overview "Needs attention" rows** get the same inline Confirm pickup and Confirm return
(deferred).

## 3. Clarity at the desk (P1/P2, staff side)
- **Accessible names on row actions:** an `aria-label` that names the item, through `t()`, e.g.
  "Confirm return of {title} from {member}" and "Approve {member}'s request for {title}". The
  visible text stays short.
- **Pickups "closing soon":** use Lucide `Clock` with amber, not `AlertTriangle`, which means overdue.
- **Remove the doubled titles:** where a panel title repeats the page title, drop the panel title
  or make it say something different (for example, "Awaiting pickup · 3").
- **"On loan" means different numbers on different pages.** Name them distinctly: Overview's
  "On loan" excludes overdue loans, so label it "On loan (not overdue)", or make the two figures
  agree. Pick one and say which.
- **"Run scheduled checks":** rename to "Update expired holds and overdue loans now", with a
  one-line description.

## Tests to add
- `rejection_reason` is stored, appears in the notification params, and is serialized.
- `search` on borrow-records (member name, title, ISBN, shelf).
- `bookFreeCopies`, `memberHasOverdue` and `memberActiveLoans` on the approvals list, with a
  constant query count for 3 and for 20 rows.

## Browser checks
Use the `demo-dev` launch config and read the DOM through JavaScript, because the pane may be
hidden. As Marcus:
1. Type `/`; the search is focused. Search "priya" and open her workstation. Confirm a pickup,
   press Undo, and check that nothing changed. Confirm it again, navigate away, and check that
   the pickup was saved.
2. Paste a scan URL (`http://localhost:3002/scan/<Priya's uuid>`, read from the users API) into
   the search and press Enter; her workstation opens.
3. Reject with a reason. As Priya, the reason shows in My requests and in the bell.
4. Delete-book dialog: Cancel keeps the book.
5. Arabic: the desk search and the workstation mirror correctly.

## Report
- the files changed;
- the test and E2E results;
- E2E specs you adjusted, and why;
- what you verified in the browser;
- any deviations, with your reasoning.
