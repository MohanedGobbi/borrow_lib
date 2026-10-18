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
- The public Vercel deployment is a self-contained demo (in-browser backend, data kept per visitor); the real deployment pairs the React frontend with the Django API in `backend/`.

## Capabilities and Constraints

- State machine: PENDING → READY → BORROWED → RETURNED; PENDING → REJECTED; READY → CANCELLED (48h expiry, queue handoff); BORROWED → OVERDUE.
- `availableCopies` changes only at pickup (−1) and return (+1). `freeCopies` = `availableCopies` minus copies held for pickup (READY); approval, new requests and queue handoff use it.
- Returns serve the reservation queue first (FIFO, skipping deactivated members) before a copy is free for anyone else.
- Deactivating a member blocks sign-in and new requests or reservations.
- Roles: MEMBER, STAFF, ADMIN; staff and admins join through single-use email invites from an admin.
- Languages: EN / FR / AR with RTL layout for Arabic.
- Stack: React 19, Vite, TypeScript, Tailwind CSS 3, shadcn/ui; Django REST backend.

## Brand Commitments

- Product name: **LibBorrow**. Institution: **University of Ghardaia** (Université de Ghardaïa / جامعة غرداية); the official seal sits beside the LibBorrow wordmark.
- Tone: serious and institutional, suitable for a university; not playful.
- Palette constraint from the owner: simple colors — green, white and red.
- Visual standard (owner, 2026-10-03): the category standard, executed to the polish of Apple, top university sites (Harvard, Oxford, MIT) and modern library sites (NYPL, British Library). Not template-like, not bulky, fast on phones; no 3D.
- Logo: the LibBorrow wordmark, with the University of Ghardaia's official seal beside it. The seal keeps its own colours and is never redrawn or recoloured.
- Photography: real library photographs; the shipped ones are Unsplash placeholders (credited) that admins can replace in the app.

## Evidence on Hand

- Seed dataset (18 books, 8 users, sample records and reservations) in `backend/library/management/commands/seed_demo.py`, mirrored in `src/api/demo.ts`.
- No real usage statistics, testimonials or partner institutions exist; do not invent them.

## Product Principles

1. The desk comes first: staff actions must be fast, unambiguous and hard to do by mistake.
2. Deadlines are always visible: every held or borrowed book shows its time remaining.
3. One flow, fairly enforced: the same rules (48h hold, 14-day loan, overdue block, FIFO queue) apply to everyone and are explained in plain language.
4. Trilingual by default: nothing may break or read awkwardly in Arabic RTL or French.

## Accessibility & Inclusion

Must work in RTL (Arabic) as well as LTR. Status must never be conveyed by color alone (red/green are the core palette), keyboard use at the desk must be supported, and text contrast should meet WCAG AA.
