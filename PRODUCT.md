# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A mixed audience of the Faculty of Law and Political Sciences, University of Ghardaia: students, professors,
administrative staff and external readers (all `MEMBER` accounts), who search the catalogue and request books
online, plus librarians (`STAFF`) and administrators (`ADMIN`) who run the circulation desk. Visitors mostly
open the public pages on computers (faculty terminals, laptops); phones must still work.

## Product Purpose

The library's online borrowing system: find a book in the faculty's real inventory, request it, collect it at
the circulation desk, return it on time. Success is a reader who finds the title and gets it in hand without a
wasted trip to the desk; for staff, a desk that shows what to approve, hand over and chase.

## Positioning

It is the faculty's own library, not a generic catalogue: its real shelves (call numbers, Dewey subjects derived
from them), its rules (pickup window, loan length, renewals, set by the library's administrators), its two seals
and its motto.

## Operating Context

A loan starts at pickup at the circulation desk, not at approval. Approved books wait on the hold shelf for the
pickup window; a missed pickup goes to the next reader in the waiting list. Readers carry a digital library card
with a QR code that staff scan at the desk. The rules' numbers live in `LibrarySettings` and change without a
deploy, so copy quotes them as variables.

## Capabilities and Constraints

- Trilingual: Arabic (default, right to left), French, English. Every screen must work RTL.
- Real catalogue only (`backend/library/data/inventory.csv`); no demo or seed data.
- Paginated APIs; never fetch whole lists to the browser.
- Opening hours of the desk: to be supplied by the library; not yet in the codebase.

## Brand Commitments

- The University of Ghardaia seal and the Faculty of Law and Political Sciences seal, in their own colours,
  never recoloured, cropped or set on red or green fills.
- The full name "مكتبة كلية الحقوق والعلوم السياسية — جامعة غرداية" and the motto
  "التميز في المعرفة ... الريادة في الحقوق".
- Deep green `#0E6B3C` as the institution's colour; red only for overdue, rejection and destructive actions.
- Serious and institutional, never playful.

## Evidence on Hand

- Seals: `public/brand/`. Photographs: the faculty building, the university building, a vaulted library aisle
  (`public/images/`), admin-replaceable through `src/lib/siteImages.ts`.
- Live data: the catalogue's titles, authors and call numbers; the title count; the rule values.
- No testimonials, usage statistics, opening hours or staff names exist yet; do not invent them.

## Product Principles

1. The catalogue is the front door: finding a book is never more than one action away.
2. The faculty's identity is fixed; expression lives around it, never on top of it.
3. Show the real library (its titles, shelves, rules) rather than claims about it.
4. Arabic first: a layout that only works left to right is broken.
