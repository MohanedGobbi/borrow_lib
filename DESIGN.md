# Design system

The site of the library of the Faculty of Law and Political Sciences, University of Ghardaia. It should read
like the faculty's own banner: white pages, the two official seals, one deep green, red only for what is late or
destructive. Serious and institutional, never playful. Arabic is the default language and every screen must work
right to left.

Tokens live in `tailwind.config.js` and `src/index.css`; components in `src/components/` (shadcn/ui primitives in
`src/components/ui/`).

## Colour

| Token | Value | Use |
|---|---|---|
| `ink` | `#121A16` | text |
| `white` / `background` | `#FFFFFF` | pages, panels |
| `surface` | `#F5F7F6` | footer, staff sidebar, table headers, row hover |
| `brand` | `#0E6B3C` | primary buttons, active navigation, selection, focus |
| `brand-dark` | `#0A5230` | hover, links, the motto band on the landing page |
| `brand-soft` | `#E7F2EB` | selected rows and options, the avatar |
| `danger` | `#B42318` | overdue, rejection and destructive actions only |
| `danger-soft` | `#FDEDEB` | error messages, overdue rows |
| `warning` | `#A34A06` | due soon |
| gold hairline | `#B8975A` at 60% | the short rule under "جامعة غرداية" on the landing page (from the banner) |

Status is never shown by colour alone: badges carry an icon and a word.

## Type

- **Display and titles:** Source Serif 4, with Noto Naskh Arabic for Arabic (`font-display`, `.type-display`,
  `.type-title`, `.type-heading`). Arabic is never letter-spaced.
- **Interface:** Public Sans, with Noto Sans Arabic (`font-sans`).
- **Identifiers** (card numbers, call numbers, ISBNs): JetBrains Mono, wrapped in `dir="ltr"`.
- Tabular figures everywhere, so counts and dates do not jitter.

## Seals

The University of Ghardaia seal (`public/brand/ghardaia-seal*.png`) and the Faculty of Law and Political Sciences
seal (`public/brand/faculty-seal*.png`) keep their own colours. Never recolour, outline, shadow, stretch or crop
them, never set them on red or on a green fill, and keep them between 28 and 72px on screen (17mm in PDFs).
Use `<Seal which="university" | "faculty" />` and `<Wordmark />` from `src/components/Wordmark.tsx`.

- **Header:** both seals (only the faculty's on phones), then "مكتبة كلية الحقوق" over "جامعة غرداية".
- **Footer, sign-in panel, library card:** both seals with the full name "مكتبة كلية الحقوق والعلوم السياسية".
- **Landing page:** as on the faculty banner, the faculty seal on the right and the university seal on the left
  (in Arabic), with the university, the faculty and the library line between them.
- **PDFs:** both seals on white, the Arabic name set in Noto Naskh Arabic through `backend/library/pdftext.py`.

## Photographs

The faculty building (landing page) and the university building, in colour, from the faculty's banner
(`public/images/`). Admins replace any photograph in Settings → Site photos; uploads are re-encoded to WebP.
The sign-in panel uses a library interior under a dark scrim (`.panel-scrim`) so white text stays legible.

## Layout

- Public pages: up to 1152px (landing) or 1280px wide, 16 / 24 / 32px side padding at phone / sm / lg.
- Staff desk: up to 1440px with a sidebar of grouped links and live counts.
- Use logical properties (`ms-`, `pe-`, `start-`, `text-start`) so layouts mirror in Arabic.
- Check every screen at 390px and 1440px, in Arabic first.

## Surfaces and controls

- Flat and hairline-first: 1px borders, 4–6px radius on controls and panels, no gradients except the banner's
  pale wash on the landing page, no decorative illustration.
- The sticky header is white glass (`.glass-bar`).
- `Panel`, `PageHeader`, `EmptyState` and `ErrorState` from `src/components/Page.tsx` frame every staff page.
- Buttons: green primary, outlined secondary, red only for destructive confirmations.
- Every destructive admin action (Settings → Data and maintenance) asks for the password again.
- Icons: Lucide, 16–20px, beside a word.

## Motion

Short, exponential ease-out (`--ease-out-expo`). Nothing moves on scroll, and `prefers-reduced-motion` turns
transitions off.
