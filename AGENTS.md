# LibBorrow — Agent Guide

This file is written for AI coding agents that need to work on the LibBorrow project. It assumes you know nothing about the codebase.

## Project overview

LibBorrow is a **frontend demo** of a physical-library borrowing platform. Members browse the catalog and request books; staff review pending requests, confirm pickups and returns, manage inventory, and monitor loans from a staff dashboard. All data lives in an in-memory mock backend that resets on every page reload.

The project is a single-page React application built with Vite, TypeScript, Tailwind CSS, and shadcn/ui components. The full-stack specification calls for a Django/DRF backend, but this deliverable intentionally implements that backend as an in-browser store so the UX can be demonstrated without a running server.

Key business rules:

- A loan starts at **pickup**, not approval. `availableCopies` only changes at pickup (−1) and return (+1).
- Approved requests enter a `READY` state with a **48-hour pickup window**. If the member does not pick up the book in time, the request is auto-cancelled and the slot is handed to the next reservation in the FIFO queue with a fresh 48-hour window.
- Active loans run **14 days from pickup**. Past-due loans are flagged `OVERDUE` and block the member from creating new requests until the loan is returned.

State machine:

```
PENDING --(staff approves)--> READY --(staff confirms pickup)--> BORROWED --(staff confirms return)--> RETURNED
PENDING --(staff rejects)--> REJECTED
READY --(48h deadline passes)--> CANCELLED --(queue non-empty)--> new READY for next member
BORROWED --(past due date)--> OVERDUE
```

## Technology stack

- **Framework:** React 19 (function components, hooks, `StrictMode`)
- **Language:** TypeScript 5.9 (strict mode enabled)
- **Build tool:** Vite 7 with the React plugin
- **Router:** `react-router` v7 (BrowserRouter)
- **Styling:** Tailwind CSS 3.4 + PostCSS + Autoprefixer
- **Component library:** shadcn/ui ("new-york" style, CSS variables, non-RSC, Lucide icons)
- **Forms:** `react-hook-form` + `@hookform/resolvers` + Zod
- **Notifications:** `sonner` toast library
- **QR codes:** `qrcode.react`
- **Charts:** `recharts`
- **Fonts:** Chakra Petch (display / body), JetBrains Mono (labels / mono) loaded from Google Fonts
- **Linting:** ESLint 9 flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`
- **Dev plugin:** `kimi-plugin-inspect-react` is registered in `vite.config.ts` for inspection

## Project structure

```
.
├── design/
│   └── DESIGN.md                 # Archived source spec for the "Impeccable" design system
├── dist/                         # Vite production build output
├── index.html                    # HTML entry point; loads Google Fonts
├── package.json
├── vite.config.ts
├── tailwind.config.js            # Theme tokens, custom colors, fonts, radii, keyframes
├── postcss.config.js
├── eslint.config.js
├── tsconfig.json                 # Project references to tsconfig.app.json and tsconfig.node.json
├── tsconfig.app.json             # Strict browser TS config
├── tsconfig.node.json            # Strict Node TS config for Vite config
├── components.json               # shadcn/ui configuration
└── src/
    ├── main.tsx                  # React root render + BrowserRouter
    ├── App.tsx                   # Route definitions and Toaster
    ├── index.css                 # Tailwind directives + CSS variables
    ├── lib/utils.ts              # `cn()` Tailwind/clsx helper
    ├── types/
    │   └── index.ts              # Domain models: Book, User, BorrowRecord, Reservation, etc.
    ├── mock/
    │   ├── seed.ts               # Seed books, users, records, reservations, activity, notifications
    │   └── store.ts              # In-memory backend: state machine, selectors, jobs, auth
    ├── hooks/
    │   ├── useLibrary.ts         # `useSyncExternalStore` subscription to the mock store
    │   └── use-mobile.ts         # shadcn/ui mobile breakpoint hook
    ├── components/
    │   ├── Layout.tsx            # Masthead, nav, notifications, demo account switcher
    │   ├── Section.tsx           # Editorial section wrapper used on marketing-style pages
    │   ├── StatusBadge.tsx       # Borrow status badge component
    │   ├── Countdown.tsx         # Live countdown / time-ago helpers
    │   ├── BookCover.tsx         # Generated color-block book cover
    │   └── ui/                   # shadcn/ui components (40+ components)
    └── pages/
        ├── CatalogPage.tsx       # Browse/search catalog, request/reserve books
        ├── BookDetailPage.tsx    # Individual book page
        ├── MyRequestsPage.tsx    # Member request history and live countdowns
        ├── ProfilePage.tsx       # Member profile + digital ID card with QR code
        ├── DashboardPage.tsx     # Staff dashboard with all operations
        └── ScanLookupPage.tsx    # Staff scan-in lookup for a member
```

## Build and development commands

Commands are defined in `package.json`:

```bash
# Install dependencies
npm install

# Start the dev server on port 3000
npm run dev

# Type-check and build for production (output in dist/)
npm run build

# Preview the production build locally
npm run preview

# Run ESLint
npm run lint
```

Vite config notes:

- `base: './'` is set so the build can be opened from the filesystem or a sub-path.
- The `@` alias resolves to `./src`.
- Dev server port defaults to `3000`.

## Code style guidelines

- **Formatting:** Use double quotes for strings, semicolons, and 2-space indentation as already used throughout the project.
- **Imports:** Use the `@/` path alias for `src` imports (e.g. `import { useLibrary } from "@/hooks/useLibrary"`).
- **Components:** React function components, default exports for pages, named exports for reusable components and hooks.
- **Class merging:** Use `cn(...)` from `@/lib/utils` when combining Tailwind classes, especially for conditional classes.
- **shadcn/ui components:** Live in `src/components/ui/` and should be treated as generated code. Import them with `@/components/ui/<name>`.
- **Tailwind tokens:** Prefer the project-specific tokens (`bg-cream`, `text-ink`, `bg-burnt`, `text-brand`, `font-mono`) over raw values. CSS variables for shadcn/ui components are defined in `src/index.css` and referenced in `tailwind.config.js`.
- **TypeScript:** Strict mode is enabled. Avoid unused locals/parameters. Prefer `type` imports where appropriate.
- **Dates:** Business logic stores timestamps as millisecond numbers (`number`). UI code formats them with `toLocaleDateString()` and the `timeAgo` helper in `Countdown.tsx`.

## Testing instructions

The project currently has **no automated test suite**. Verify changes by:

1. Running `npm run lint` and `npm run build` to catch TypeScript and ESLint errors.
2. Running `npm run dev` and exercising the relevant user flows in the browser.
3. Using the account switcher in the header to toggle between roles:
   - **Admin:** `Eleanor Vance` — full access.
   - **Staff:** `Marcus Holloway`, `Greta Weiss` — can use the dashboard and scan pages.
   - **Member:** `Priya Sharma`, `Daniel Okafor` (overdue), `Sofia Lindqvist`, `Tomás Rivera`, `Hana Yoshida` — member catalog/request/profile views.

Important demo flows to sanity-check:

- Members can request a book with available copies or join the reservation queue for a zero-stock book.
- Staff can approve/reject `PENDING` requests, confirm pickup, confirm return, and edit/delete books from the dashboard.
- Confirming a pickup decrements `availableCopies`; confirming a return increments it.
- An overdue member cannot request new books until the overdue loan is returned.
- The reservation queue promotes the next member when a `READY` record expires or a copy is returned.

## Mock backend architecture

`src/mock/store.ts` is the single source of truth. It exports:

- `ApiError` — thrown for 400/403/404/409-style failures.
- `subscribe(listener)` / `getVersionTick()` — React `useSyncExternalStore` integration.
- `currentUser()` / `loginAs(userId)` — demo auth.
- Borrow lifecycle: `createBorrowRequest`, `approveRequest`, `rejectRequest`, `confirmPickup`, `confirmReturn`.
- Reservations: `createReservation`, `queueForBook`.
- Background jobs: `runHourlyJob()`, `runNightlyJob()` (run on load and every 60 seconds in the browser).
- Book admin: `addBook`, `updateBook`, `deleteBook`.
- Selectors: `dashboardStats`, `myRecords`, `markNotificationsRead`.

Every mutating action writes to the activity log and emits a store update so components re-render.

## Security considerations

- This is a demo application. There is **no real authentication, authorization server, or data persistence**.
- The account switcher is purely for UX demonstration. Role checks in `store.ts` mirror what a real backend should enforce, but they are client-side only and trivially bypassable.
- Do not commit real credentials, API keys, or backend connection strings.
- No tests for XSS/CSRF because there is no server. If you add a real backend, implement proper JWT/session auth, input validation, and server-side authorization.

## Deployment process

No automated deployment is configured. To deploy manually:

1. Run `npm run build` to produce static assets in `dist/`.
2. Serve `dist/` with any static-file host (the build is configured with `base: './'` for flexible hosting).

## Design system

The project uses the **Impeccable** design system. Tokens are in `tailwind.config.js` and `src/index.css`.

Key tokens:

- Cream: `#FAF3E3` (`bg-cream`, `bg-cream-deep`)
- Burnt orange: `#C55221` (`bg-burnt`, `text-burnt`)
- Brand amber: `#CC8800` (`bg-brand`, `text-brand`)
- Ink: `#111827` (`text-ink`)
- Success / warning / danger map to green / amber / red
- Border radius scale uses `var(--radius)` (base 0.5rem)
- Typography: Chakra Petch sans, JetBrains Mono mono

The archived source is `design/DESIGN.md`.

## Useful references

- `README.md` — user-facing overview and quick-start.
- `DECISIONS.md` — intentional deviations from the full-stack spec and gap-fills.
- `design/DESIGN.md` — archived design-system specification.
