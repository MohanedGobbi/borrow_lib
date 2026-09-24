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

A loan starts at physical pickup, not at approval. Approved requests hold a copy for 48 hours; missed pickups auto-cancel and the copy passes to the next student in a FIFO reservation queue with a fresh window. Loans run 14 days from pickup, and an overdue loan blocks new requests until it is returned.

## Operating Context

- Students use it on phones and laptops, often between classes.
- Staff use it at the circulation desk on a desktop, scanning the QR code on a student's digital library card to open their record.
- Printable PDFs: borrow-request receipts and the library ID card.
- The public Vercel deployment is a self-contained demo (in-browser backend, data kept per visitor); the real deployment pairs the React frontend with the Django API in `backend/`.

## Capabilities and Constraints

- State machine: PENDING → READY → BORROWED → RETURNED; PENDING → REJECTED; READY → CANCELLED (48h expiry, queue handoff); BORROWED → OVERDUE.
- `availableCopies` changes only at pickup (−1) and return (+1).
- Roles: MEMBER, STAFF, ADMIN; staff registration requires an invite code.
- Languages: EN / FR / AR with RTL layout for Arabic.
- Stack: React 19, Vite, TypeScript, Tailwind CSS 3, shadcn/ui; Django REST backend.

## Brand Commitments

- Product name: **LibBorrow**. Institution shown generically as **University Library** (no specific university is named).
- Tone: serious and institutional, suitable for a university; not playful.
- Palette constraint from the owner: simple colors — green, white and red.

## Evidence on Hand

- Seed dataset (18 books, 8 users, sample records and reservations) in `backend/library/management/commands/seed_demo.py`, mirrored in `src/api/demo.ts`.
- README screenshots in `screenshots/` show the previous (retired) orange/cream design.
- No real usage statistics, testimonials or partner institutions exist; do not invent them.

## Product Principles

1. The desk comes first: staff actions must be fast, unambiguous and hard to do by mistake.
2. Deadlines are always visible: every held or borrowed book shows its time remaining.
3. One flow, fairly enforced: the same rules (48h hold, 14-day loan, overdue block, FIFO queue) apply to everyone and are explained in plain language.
4. Trilingual by default: nothing may break or read awkwardly in Arabic RTL or French.

## Accessibility & Inclusion

Must work in RTL (Arabic) as well as LTR. Status must never be conveyed by color alone (red/green are the core palette), keyboard use at the desk must be supported, and text contrast should meet WCAG AA.
