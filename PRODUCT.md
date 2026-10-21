# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students (members)** — browse the university library catalog, request books, join reservation queues for titles with no copies on the shelf, track pickup deadlines and due dates, and show a digital library card at the desk.
- **Library staff and administrators** — work the circulation desk: approve or reject requests, confirm pickups and returns, manage inventory and categories, look up members by scanning their card, and watch loans, overdue items and analytics.

Daily use is trilingual: French, Arabic (right-to-left) and English are all first-class.

## Product Purpose

LibBorrow is the borrowing system of a university library. It replaces paper request slips and ad-hoc desk queues with one tracked flow, so students know exactly when a book is ready and staff always know what is on the shelf, on hold, or late. Success: no book is held indefinitely, overdue loans surface immediately, and the desk can process a student in seconds.

## Positioning

A loan starts at physical pickup, not at approval. Approved requests hold a copy for 48 hours; missed pickups auto-cancel and the copy passes to the next student in a FIFO reservation queue with a fresh window. Returned copies serve the queue first, and staff can approve a request only while the book has a free copy (shelf copies minus those on hold). Loans run 14 days from pickup, and an overdue loan blocks new requests until it is returned. A deactivated member cannot sign in or borrow.

## Operating Context

- Students use it on phones and laptops, often between classes.
- Staff use it at the circulation desk on a desktop, scanning the QR code on a student's digital library card to open their record.
- Printable PDFs: borrow-request receipts and the library ID card.
- The deployment pairs the React frontend with the Django API in `backend/`; there is no demo mode.

## Capabilities and Constraints

- State machine: PENDING → READY → BORROWED → RETURNED; PENDING → REJECTED; READY → CANCELLED (48h expiry, queue handoff); BORROWED → OVERDUE.
- `availableCopies` changes only at pickup (−1) and return (+1). `freeCopies` = `availableCopies` minus copies held for pickup (READY); approval, new requests and queue handoff use it.
- Returns serve the reservation queue first (FIFO, skipping deactivated members) before a copy is free for anyone else.
- Deactivating a member blocks sign-in and new requests or reservations.
- Account types: student (طالب), professor (أستاذ), administrative staff (إداري مسير), external reader (خارجي), librarian (مكتبي, STAFF) and administrator (موظف مسؤول, ADMIN). Admins create accounts of any type, other admins included.
- Languages: AR (default, RTL) / FR / EN.
- Stack: React 19, Vite, TypeScript, Tailwind CSS 3, shadcn/ui; Django REST backend.

## Brand Commitments

- Name: **مكتبة كلية الحقوق والعلوم السياسية** (Faculty of Law and Political Sciences Library), **University of Ghardaia** (جامعة غرداية). The university's and the faculty's seals sit beside the library's name.
- Tone: serious and institutional, suitable for a university; not playful.
- Palette constraint from the owner: simple colors — green, white and red.
- Visual standard (owner, 2026-10-03): the category standard, executed to the polish of Apple, top university sites (Harvard, Oxford, MIT) and modern library sites (NYPL, British Library). Not template-like, not bulky, fast on phones; no 3D.
- Logo: the library's name with both official seals beside it. The seals keep their own colours and are never redrawn or recoloured.
- Photography: the faculty and university buildings (from the faculty's banner); admins can replace them in the app.

## Evidence on Hand

- The library's real inventory: 4,487 titles (law and political science, Dewey call numbers, almost all in Arabic) in `backend/library/data/inventory.csv`.
- No real usage statistics, testimonials or partner institutions exist; do not invent them.

## Product Principles

1. The desk comes first: staff actions must be fast, unambiguous and hard to do by mistake.
2. Deadlines are always visible: every held or borrowed book shows its time remaining.
3. One flow, fairly enforced: the same rules (48h hold, 14-day loan, overdue block, FIFO queue) apply to everyone and are explained in plain language.
4. Trilingual by default: nothing may break or read awkwardly in Arabic RTL or French.

## Accessibility & Inclusion

Must work in RTL (Arabic) as well as LTR. Status must never be conveyed by color alone (red/green are the core palette), keyboard use at the desk must be supported, and text contrast should meet WCAG AA.
