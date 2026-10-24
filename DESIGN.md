---
name: Faculty of Law Library, University of Ghardaia
description: The borrowing site of the faculty library, set like the faculty's own banner.
colors:
  ink: "#121A16"
  white: "#FFFFFF"
  surface: "#F5F7F6"
  brand: "#0E6B3C"
  brand-dark: "#0A5230"
  brand-soft: "#E7F2EB"
  danger: "#B42318"
  danger-soft: "#FDEDEB"
  warning: "#A34A06"
  gold-hairline: "#B8975A"
  aisle-plaster: "#FBFBF8"
  aisle-fog: "#F8F8F5"
typography:
  landing-display:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "clamp(2.375rem, 1.4rem + 3.4vw, 4.75rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.022em"
  display:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "clamp(2.125rem, 1.45rem + 2.2vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "clamp(1.75rem, 1.5rem + 0.7vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.016em"
  feature:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  heading:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.006em"
  lead:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  xl: "10px"
  arch: "999px"
spacing:
  gutter-phone: "16px"
  gutter-sm: "24px"
  gutter-lg: "32px"
  plaque-phone: "24px"
  plaque-sm: "36px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-primary-lg:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 28px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-dark}"
  landing-plaque:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.plaque-sm}"
    width: "600px"
  landing-search:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "64px"
---

# Design system

The site of the library of the Faculty of Law and Political Sciences, University of Ghardaia. It should read
like the faculty's own banner: white pages, the two official seals, one deep green, red only for what is late or
destructive. Serious and institutional, never playful. Arabic is the default language and every screen must work
right to left.

Tokens live in `tailwind.config.js` and `src/index.css`; components in `src/components/` (shadcn/ui primitives in
`src/components/ui/`). The landing page's 3D arcade lives in `src/pages/landing/AisleScene.tsx` and
`src/lib/aisle.ts`.

## Colour

| Token | Value | Use |
|---|---|---|
| `ink` | `#121A16` | text |
| `white` / `background` | `#FFFFFF` | pages, panels, the landing plaques |
| `surface` | `#F5F7F6` | footer, staff sidebar, table headers, row hover, loading bars |
| `brand` | `#0E6B3C` | primary buttons, active navigation, selection, focus; the runner and step numbers on the landing page |
| `brand-dark` | `#0A5230` | hover, links, the motto and call numbers on the landing page; the painted stacks in the arcade |
| `brand-soft` | `#E7F2EB` | selected rows and options, the avatar |
| `danger` | `#B42318` | overdue, rejection and destructive actions only |
| `danger-soft` | `#FDEDEB` | error messages, overdue rows |
| `warning` | `#A34A06` | due soon |
| gold hairline | `#B8975A` | landing page only: the plaque edge (50%), the rule in the banner (70%), the rules beside the motto (60%), rules and dividers inside a plaque (30–40%) |
| arcade plaster / fog | `#FBFBF8` / `#F8F8F5` | the arches and vaults of the landing scene, and the white fog the aisle recedes into |

Status is never shown by colour alone: badges carry an icon and a word.

## Type

- **Display and titles:** Source Serif 4, with Noto Naskh Arabic for Arabic (`font-display`, `.type-display`,
  `.type-title`, `.type-heading`). Arabic is never letter-spaced.
- **Landing display:** the faculty's name in the first arch is one step above `.type-display`
  (`.landing-display`, up to 76px; line height 1.3 in Arabic). Nothing else uses it.
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
- **Landing page:** the banner lockup in the first arch. As on the faculty banner, the faculty seal on the right
  and the university seal on the left (in Arabic), 48px on phones and 72px from `sm`. Between them, one `h1`:
  "جامعة غرداية", a short gold rule, then the faculty's name at landing display size. The library line sits under
  the lockup, not between the seals.
- **PDFs:** both seals on white, the Arabic name set in Noto Naskh Arabic through `backend/library/pdftext.py`.

## Photographs

The faculty building (landing page, in an arched window on the last plaque, the shape of the arcade it ends) and
the university building, in colour, from the faculty's banner (`public/images/`). Admins replace any photograph
in Settings → Site photos; uploads are re-encoded to WebP. The sign-in panel uses a library interior under a dark
scrim (`.panel-scrim`) so white text stays legible.

## Layout

- Public pages: up to 1280px wide, 16 / 24 / 32px side padding at phone / sm / lg.
- Landing page: five full-height stations (`100svh`), one per arch, each centred. The first arch holds the banner
  and search (up to 768px, the search up to 672px); every other station is a plaque up to 600px wide.
- Staff desk: up to 1440px with a sidebar of grouped links and live counts.
- Use logical properties (`ms-`, `pe-`, `start-`, `text-start`) so layouts mirror in Arabic.
- Check every screen at 390px and 1440px, in Arabic first.

## Surfaces and controls

- Flat and hairline-first: 1px borders, 4–6px radius on controls and panels, no gradients and no decorative
  illustration. The landing page is the one exception (see below): its arcade, the placeholder behind it and the
  scrim in the first arch.
- The sticky header is white glass (`.glass-bar`).
- `Panel`, `PageHeader`, `EmptyState` and `ErrorState` from `src/components/Page.tsx` frame every staff page.
- Buttons: green primary, outlined secondary, red only for destructive confirmations.
- Every destructive admin action (Settings → Data and maintenance) asks for the password again.
- Icons: Lucide, 16–20px, beside a word.

## Landing page: the arcade

The front page is a walk down the library's own arcade, drawn in WebGL behind the content and held in place
(sticky, full viewport) while the stations scroll over it.

- **The scene:** eight white lime-plaster arches in the manner of the M'zab, each a little different, with
  thick rounded edges, hand-plastered waves and a darker foot where the wall meets the floor; barrel vaults over
  the bays; deep-green painted stacks in every bay, filled spine by spine with the catalogue's real cover colours
  (mixed with a fixed shelf palette); a green runner down a pale stone floor; a doorway of daylight at the far end
  and white fog. High sun from the far end, a soft fill from behind the visitor, neutral tone mapping so the
  plaster stays white.
- **Bay plates:** brass plates on the face of each arch's piers, one either side of the opening, lettered with
  the subjects that have books in the catalogue (largest first, up to 14). They sit beside the opening so the
  plaques never cover them.
- **Plaques:** all text past the first arch sits on a white plaque (97% white, `rounded-md`), with a gold
  hairline edge and a soft shadow that falls below it (`0 28px 64px -28px`, ink at 35%), at most 600px wide,
  24 / 36px padding at phone / sm. Rules inside a plaque are gold hairlines too. Titles are `.type-title`,
  step numbers are serif in `brand`.
- **First arch:** the banner lockup over a radial white scrim (`.arrival-scrim`) that keeps it legible wherever
  the stacks fall behind; a 64px search field (white, 1px border, a green-tinted soft shadow that deepens and
  turns the border `brand` on focus) with the green Search button inside it; sign in / join (or My loans / Staff
  desk) under it; a white pill at the foot that walks on to the next arch.
- **No WebGL:** if WebGL is missing or the scene fails, the page keeps `.aisle-placeholder` (daylight down the
  middle, plaster grey at the edges) and every station still works; nothing depends on the scene.
- **Phones:** no shadows in the scene, a wider lens, a lower pixel ratio. The scene stops drawing once it has
  scrolled out of view. three.js is lazy-loaded and stays out of every other page's bundle.

## Motion

Short, exponential ease-out (`--ease-out-expo`) everywhere, and `prefers-reduced-motion` turns transitions off.
Outside the landing page nothing moves on scroll.

The landing page is the exception, and moves like a walk:

- **Smooth scroll:** Lenis (`useSmoothScroll`, lerp 0.085) while the page is mounted; menus, dialogs and
  popovers keep the browser's scrolling. "Walk in" glides to the next station in 1.8s.
- **The camera:** scroll moves it one arch per station, stopping in front of each so the arch frames the plaque,
  damped rather than locked to the scrollbar; it sways a little with the pointer. On arrival it steps in from
  outside the first arch (2.6s, expo out); the content is already on screen, only the view moves. The canvas
  fades in over the placeholder once its first frame is drawn (1s).
- **"On the shelf now":** every 4.2s the plaque turns to another available title, line by line (call number,
  title, author, availability), the old lines lifting away and the new ones rising in. It stops on hover or
  focus, and has a pause / play button.
- **Reduced motion:** no Lenis, the camera held at the first arch with no intro and no pointer sway, the shelf
  plaque standing still with no pause button.
