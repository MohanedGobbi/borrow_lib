---
name: LibBorrow
description: The borrowing portal of a university library. White pages, one deep university green, red only for what is late or destructive, black-and-white photographs, a serif voice for headlines.
colors:
  university-green: "#0E6B3C"
  university-green-deep: "#0A5230"
  green-wash: "#E7F2EB"
  ink: "#121A16"
  paper: "#FFFFFF"
  reading-room-grey: "#F5F7F6"
  muted-ink: "#545F59"
  hairline: "#DBE1DE"
  field-stroke: "#C8D0CC"
  overdue-red: "#B42318"
  overdue-wash: "#FDEDEB"
  scrim: "#080C0A"
typography:
  hero:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "clamp(2.625rem, 1.15rem + 4.6vw, 5.25rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.026em"
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
  subtitle:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.375
  heading:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.006em"
  figure:
    fontFamily: "Source Serif 4, Noto Naskh Arabic, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
  lead:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  body-dense:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
  identifier:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  cover: "3px"
  md: "4px"
  lg: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.university-green}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.university-green-deep}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.university-green-deep}"
  button-destructive:
    backgroundColor: "{colors.overdue-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "44px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 14px"
    height: "44px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16px"
  status-badge-overdue:
    backgroundColor: "{colors.overdue-wash}"
    textColor: "{colors.overdue-red}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-borrowed:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.university-green-deep}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  book-cover:
    backgroundColor: "{colors.reading-room-grey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cover}"
---

# Design System: LibBorrow

## Overview

**Creative North Star: "The Reading Room"**

LibBorrow is the portal a serious university library would put in front of its students: a white page, a deep university green, black-and-white photographs of real reading rooms, and headlines set in a book serif. The public side (landing, catalog, book page, sign-in) carries the identity at full strength: a full-bleed monochrome photograph under a translucent header, a large serif headline, one wide search field. Signed-in and staff screens share the same type, palette and hairlines but stay quiet, dense and fast; they are the circulation desk, not the lobby.

The system is built from hairlines and space, not boxes and shadows. Lists are rows divided by 1px rules; panels are white with a hairline edge; large numbers and titles are set in Source Serif 4 so even the staff overview reads like a printed ledger. Colour is spent sparingly: green marks the one primary action and the current selection, red marks only what is late, rejected or destructive. Everything else is ink on paper.

The build explicitly rejects the SaaS-template look: no card grids with icons, no gradients, no decorative illustration, no 3D, no logo symbol of our own. The wordmark is the brand, and the university's official seal stands beside it.

**Key Characteristics:**
- White ground, one deep green, red reserved for late and destructive; neutrals tinted toward the green.
- Source Serif 4 (Noto Naskh Arabic) for headlines, page titles, book titles, large figures and the wordmark; Public Sans (Noto Sans Arabic) for every interface word.
- Tabular figures everywhere, so dates, counts and countdowns never jitter.
- 1px hairlines and generous vertical space instead of shadows and containers.
- Black-and-white architectural photography, admin-replaceable, each raster shipped with a provenance sidecar.
- Full mirroring in Arabic via logical properties; Arabic display type is never tracked.

## Colors

A near-monochrome ink-on-paper palette with one institutional green and one alarm red.

### Primary
- **University Green** (#0E6B3C): the primary button, the active nav underline, selected sidebar item text, step numerals, availability dots, unread dots, the caret and focus ring. It is also the favicon ground and the browser theme colour.
- **Deep University Green** (#0A5230): primary hover, text-link colour (arrow links such as "View the full catalog"), text on Green Wash, and the demo notice bar.
- **Green Wash** (#E7F2EB): the BORROWED badge ground, selected sidebar row, outline-button hover, the member avatar ground.

### Tertiary
- **Overdue Red** (#B42318): overdue counts and figures, "days overdue" text, the OVERDUE badge, rejection, blocked-request notices, destructive buttons, the unread-notification and overdue-loans count chips.
- **Overdue Wash** (#FDEDEB): the ground of overdue badges and overdue/blocked notices, always with a red-at-30% hairline.

### Neutral
- **Ink** (#121A16): headings and body text; a green-tinted near-black, never pure black.
- **Paper** (#FFFFFF): the page and every panel.
- **Reading Room Grey** (#F5F7F6): alternate landing bands, the staff sidebar, table headers, typographic book covers, the footer, row hover.
- **Muted Ink** (#545F59): descriptions, metadata, column headers, figure labels.
- **Hairline** (#DBE1DE): every border, divider and table rule.
- **Field Stroke** (#C8D0CC): input borders, one step firmer than Hairline so fields read as fields.
- **Scrim** (#080C0A): the ink one step darker, used only as the RGB base of the photo legibility gradients (hero and auth panel).

### Named Rules
**The One Green Rule.** Green is the only accent. There are no secondary brand hues, no gradients except the photo scrims, and no tinted illustration. A screen has at most one filled green button.

**The Red Means Late Rule.** Red is reserved for overdue, rejected, blocked and destructive. A failed load or an important notice is shown in ink on Reading Room Grey, not in red.

**The Seal Exception Rule.** The University of Ghardaia's official seal keeps its own colours. It is the one deliberate exception to the green, white and red palette, as any university crest is. Never recolour, outline, add a shadow to, stretch or crop it. Leave clear space of at least 25% of its height on every side; show it between 28px and about 72px, because the source is only 160px wide (use the 1x, 2x and 3x files in `public/brand/`). Set it on white, on Reading Room Grey, or on the dark hero photograph under its scrim; never on red and never on a green fill.

**The Never Color Alone Rule.** Every status carries an icon and a word as well as a colour (Clock pending, PackageCheck ready, BookOpen borrowed, AlertTriangle overdue, XCircle rejected, Ban cancelled). Red/green colour blindness must not hide a state.

## Typography

**Display Font:** Source Serif 4, optical sizing on (Noto Naskh Arabic for Arabic, Georgia fallback)
**Body Font:** Public Sans (Noto Sans Arabic for Arabic, system sans fallback)
**Label/Mono Font:** JetBrains Mono, for machine identifiers only (ISBNs, card numbers, request codes)

**Character:** A bookish transitional serif speaks for the institution; a plain civic sans (originally designed for US government services) does the work. The pairing reads as library, not startup.

### Hierarchy
- **Hero** (400, clamp 42 to 84px, 1.02): the landing headline only, white over the photograph.
- **Display** (400, clamp 34 to 56px, 1.05): landing section headings, the book page title, the auth-panel wordmark scale.
- **Title** (600, clamp 28 to 36px, 1.12): the PageHeader title on every signed-in and staff screen.
- **Feature** (600, 26px, 1.15): the lead item of a list, such as the most urgent loan.
- **Subtitle** (600, 22px, 1.375): dialog and alert-dialog titles, landing shelf book titles (24px from sm), the secondary figures in My loans.
- **Heading** (600, 19px, 1.25): book titles in shelf lists and result rows.
- **Figure** (500, 36px, 1, tabular): the large numbers of the staff Figures row; red only when the figure counts late items.
- **Lead** (400, 17px, 1.6): intro paragraphs under display headings.
- **Body** (400, 15px, 1.5): the default interface size; panel titles use it at 600. Keep reading text to about 65ch (max-w-2xl).
- **Body dense** (400, 14px): table cells, menu items, secondary rows.
- **Label** (500, 13px): table column headers, figure labels, counts beside panel titles, sidebar group labels in sentence case.
- **Caption** (400 to 500, 12px): badges, timestamps, helper lines.

### Named Rules
**The Serif Speaks, the Sans Works Rule.** Serif is for things you read as titles (headlines, page titles, book titles, big figures, the wordmark). Buttons, labels, nav, fields, tables and body copy are always Public Sans.

**The Tracking Follows Size Rule.** Serif tracking tightens as size grows (from -0.006em at 19px to -0.026em at the hero). Arabic is never tracked, gets weight 500 at hero and display, and opens line-height to 1.3 to 1.5 so the joins and marks breathe.

**The Tabular Rule.** The body sets tabular figures globally; counts, dates, countdowns and table columns never shift width while they tick.

**The Mono Is For Codes Rule.** JetBrains Mono appears only on identifiers a person matches character by character, always wrapped in dir="ltr".

## Layout

Public pages sit in a 1280px container (max-w-7xl) with 16 / 24 / 32px side padding at phone / sm / lg; the staff desk widens to 1440px with 16 / 24px padding and a fixed left sidebar on Reading Room Grey. Page content opens 32px below the header on phones and 48px from lg. The header is 64px, sticky, and on the landing page overlays the hero (the photograph runs up behind it).

The landing is a sequence of full-width bands that alternate Paper and Reading Room Grey, each opened by a Display heading with a Lead paragraph set to the side on wide screens. Lists are columns of rows with a hairline above each, not cards: "On the shelf now" is three columns of hairline-topped entries. Staff screens stack a search/scan field, a Title, a Figures row, then panels in a two-column grid that collapses to one below lg. Work-queue tables turn into stacked rows below 640px (actions last) instead of scrolling sideways. Rhythm is an 4px base: 8 and 12px inside rows, 16px panel padding, 24 to 32px between blocks, large bands of 96px or more on the landing.

## Elevation & Depth

The system is flat. Depth comes from tone (Paper over Reading Room Grey), hairlines, and the photograph, never from cast shadows on panels, rows or covers. The only lifted surfaces are the shadcn overlays (menus, popovers, dialogs, toasts), which keep their library shadow because they float over content, and outline buttons and inputs, which carry a barely-there 1px shadow (`0 1px 2px 0 rgb(0 0 0 / 0.05)`) to read as pressable.

### Shadow Vocabulary
- **Field lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): outline buttons and inputs only.

### Named Rules
**The Hairline First Rule.** Separate with a 1px Hairline rule or a tonal step before anything else. Panels, tables, figures and book covers carry no shadow.

**The Glass Header Rule.** The sticky header is white glass (white at 72% with saturate 1.8 and 20px blur, solid white at 96% where backdrop-filter is unsupported) with a hairline bottom edge; over the landing hero it turns transparent with white type and settles to glass as the page scrolls.

## Shapes

Corners are small and institutional: 4px on buttons, fields, panels and figure grids; 6px on dialogs and larger overlays; 3px on book covers, so they read as printed objects. Pills (full radius) are kept for status badges, count chips, avatars and the empty-state icon disc. Photographs are square-cornered and full-bleed. Lines are 1px everywhere; the only 2px line is the active nav underline.

## Components

### Buttons
Calm and confident; 44px tall by default so every action is a comfortable tap.
- **Shape:** gently squared (4px).
- **Primary:** University Green, white 15px medium text, 20px side padding; hover deepens. One per view.
- **Outline:** white with a Hairline border and field lift, ink text; hover turns Green Wash with deep-green text. The default for row actions such as "Confirm return".
- **Destructive:** Overdue Red fill, only for delete, reject and cancel.
- **Sizes:** sm 36px (14px text) for table rows and panel headers, lg 48px for landing calls to action.
- **Focus:** a 3px ring of green at 50%; all other focusable elements get a 2px solid green outline offset 2px.
- **Arrow link:** deep-green medium text with a trailing arrow that slides 3px toward its destination on hover (mirrored in Arabic).

### Chips (Status badges)
- **Style:** pill, 12px medium text, 10px side padding, a 14px Lucide icon before the word.
- **State:** PENDING grey ground, ink; READY white with a green hairline; BORROWED Green Wash; RETURNED, REJECTED, CANCELLED white with a hairline, muted text; OVERDUE Overdue Wash, red text, red hairline.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Paper.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 16px; a 52px header row with a 15px semibold title and a muted tabular count; `flush` panels drop padding for tables and lists.

### Inputs / Fields
- **Style:** 44px tall, Field Stroke border, 4px radius, white, 14px side padding, 15px text (16px on phones to stop iOS zoom).
- **Focus:** green border with the 3px green ring.
- **Error / Disabled:** red border and ring on invalid; 50% opacity when disabled.
- **Search:** the landing search is one wide white field with a leading search icon and the primary button inset at its end.

### Navigation
- **Header:** the seal and wordmark at the start, then 15px medium nav links each with a 2px green underline when active; language, notifications, request list and the user menu at the end as 40px icon buttons. Count chips sit on icons: green for the request list, red for unread notifications.
- **Staff sidebar:** Reading Room Grey column, sentence-case group labels in Muted Ink, rows with a Lucide icon, label and tabular count; the selected row is Green Wash with green text; an overdue count becomes a red chip.
- **Mobile:** nav collapses into the user menu; the header stays 64px.

### Tables
Hairline rows, a 40px header on Reading Room Grey at 60% with 13px muted labels, 14px cells with 14px vertical padding, quiet grey hover; keyboard-selected rows (J/K) take the same tint with an inset focus outline.

### Figures (signature)
A row of large serif numbers for the top of staff screens: cells separated by 1px gaps over a Hairline ground, a 13px muted label above, the figure in Source Serif 4 at 36px; a cell with a destination is a whole-cell link that tints grey on hover; red only for late counts.

### Book Cover (signature)
When a book has no image, the cover is typographic: a 2:3 Reading Room Grey block with a 3px radius and hairline, the title in the serif, the author in muted sans, and at large sizes the library's name set at the foot as an uppercase imprint, as a publisher's line on a real cover. The imprint belongs to the cover object only; it is not a page-level label style.

### Wordmark and seal
The institution is the **University of Ghardaia** (Université de Ghardaïa, جامعة غرداية). Its official seal comes first in reading order (left in LTR, right in RTL), then a 1px hairline divider, then "LibBorrow" in Source Serif 4 semibold, then the university's name in Public Sans: stacked under the wordmark on phones, set beside it after a second divider on wide screens. The seal never replaces the wordmark.
- **Header:** seal 32px on phones, 40px from `lg`; it holds on the transparent state over the hero (the white-centred medallion reads on the dark photograph) and on the white glass.
- **Footer:** seal 56px, 64px from `md`, with the wordmark and "University of Ghardaia · Library", and the university's name in French, Arabic and English in the small print.
- **Library card:** seal top-start at 44px beside the wordmark. **Sign-in panel:** seal at 64px above the display wordmark on the photograph.
- **PDFs:** the seal top-left at 17mm on white (the ID card header is white with a hairline, not a green band), with the university's name in the header.
- **Rules:** see The Seal Exception Rule. Size 28 to about 72px, clear space 25% of its height, grounds white, grey or the dark photograph only.
- **Favicon:** the serif L on a green square stays; the seal cannot be read at 16px.

### Photography
Black-and-white WebP photographs of library architecture in 640 / 1200 / 2000px widths, each with a `.json` provenance sidecar (source, licence, date), replaceable by admins. Over a photograph, text sits on an ink scrim gradient that is darkest under the headline and the header and clears where the image is calm. Photographers are credited in the footer.

### Motion
Every transition eases out exponentially (`cubic-bezier(0.16, 1, 0.3, 1)`). On first paint the hero photograph settles from 1.07 scale over 2.6s and the headline rises 24px over 1.5s, transform only, so text is legible from the first frame. On the landing page only (fine pointers), Lenis smooth scroll and GSAP draw the step line and slowly drift the feature photograph. All motion collapses under reduced-motion.

## Do's and Don'ts

### Do:
- **Do** use University Green (#0E6B3C) for the single primary action, selection and focus, and Deep University Green (#0A5230) for links and hover.
- **Do** keep red (#B42318) for overdue, rejected, blocked and destructive, and pair every status colour with a Lucide icon and a word.
- **Do** set headlines, page titles, book titles, large figures and the wordmark in Source Serif 4; set every control and label in Public Sans.
- **Do** separate with 1px Hairlines (#DBE1DE) and tonal steps to Reading Room Grey (#F5F7F6) before considering any shadow.
- **Do** use black-and-white photography with a provenance sidecar per raster, and an ink scrim under any text placed on it.
- **Do** use logical properties so every layout mirrors in Arabic, and wrap IDs, ISBNs, shelf marks and emails in dir="ltr".
- **Do** show the University of Ghardaia seal in its own colours, between 28 and 72px, beside the wordmark, on white, grey or the dark photograph only.
- **Do** keep controls 44px tall by default and check every screen at 390px and 1440px.

### Don't:
- **Don't** introduce a second accent hue, a gradient fill, colour photographs or illustration.
- **Don't** use red for errors that are not late, rejected or destructive; a failed load is ink on grey.
- **Don't** build card grids with icon tiles, or wrap list items in shadowed cards; use hairline rows.
- **Don't** invent a logo symbol, a 3D object or a mascot; the wordmark is the brand and the university's seal is the only emblem.
- **Don't** recolour, outline, shadow, stretch, crop or enlarge the seal beyond about 72px, or set it on red or on a green fill.
- **Don't** put small uppercase tracked labels ("eyebrows") above headings; headings stand alone.
- **Don't** letter-space Arabic text, or set JetBrains Mono on anything but identifiers.
- **Don't** load Lenis or GSAP outside the public landing page, or animate opacity on text that must be readable at first paint.
