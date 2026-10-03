---
name: LibBorrow
description: The borrowing portal of a university library. White pages, one deep green, red only for what is late or destructive.
colors:
  university-green: "#0E6B3C"
  university-green-deep: "#0A5230"
  green-wash: "#E7F2EB"
  ink: "#121A16"
  paper: "#FFFFFF"
  desk-grey: "#F5F7F6"
  muted-ink: "#545F59"
  hairline: "#DBE1DE"
  field-stroke: "#C8D0CC"
  overdue-red: "#B42318"
  overdue-wash: "#FDEDEB"
  deadline-amber: "#A34A06"
typography:
  display:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
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
  body-dense:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  stat:
    fontFamily: "Public Sans, Noto Sans Arabic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  identifier:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  swatch: "2px"
  cover: "3px"
  sm: "2px"
  md: "4px"
  lg: "6px"
  xl: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  section: "56px"
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
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.university-green-deep}"
  button-destructive:
    backgroundColor: "{colors.overdue-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
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
  panel-header:
    typography: "{typography.title}"
    padding: "10px 16px"
    height: "48px"
  table-header:
    backgroundColor: "{colors.desk-grey}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    padding: "0 16px"
    height: "40px"
  status-badge:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-overdue:
    backgroundColor: "{colors.overdue-wash}"
    textColor: "{colors.overdue-red}"
  status-badge-borrowed:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.university-green-deep}"
  nav-count:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.university-green-deep}"
    rounded: "{rounded.full}"
    padding: "1px 8px"
  nav-count-overdue:
    backgroundColor: "{colors.overdue-red}"
    textColor: "{colors.paper}"
---

# Design System: LibBorrow

## Overview

**Creative North Star: "The Circulation Desk"**

LibBorrow is the category standard for a university library portal, executed carefully: white pages, one deep university green, and red kept for what is late, rejected or destructive. It aims to sit beside Primo and WorldCat for discovery and beside Linear and GitHub for staff work. Nothing is decorative. Every surface is a form, a list, a table or a count, and polish lives in hairline alignment, tabular figures and exact deadlines rather than in ornament.

Density follows the audience. Student pages (landing, catalog, book, my loans, profile) sit in a 1280px column with generous 15px body text and plenty of air. The staff desk is wider (1440px), has a 240px grey sidebar of grouped queues with live counts, and uses Linear/GitHub table density: 40px header rows, 12px cell padding and 14px text. The same components serve both. Only spacing and container width change.

The system is trilingual. Arabic (RTL) is a first-class layout, not a mirror applied afterwards. Every inline offset uses logical properties (start/end, ms/me, ps/pe), directional arrows flip in RTL, and identifiers and countdowns are pinned `dir="ltr"` inside RTL text.

**Key Characteristics:**
- White paper (#FFFFFF) for content, desk grey (#F5F7F6) for chrome: header strip, sidebar, table heads and footer.
- One accent hue. Green marks primary actions, the brand mark, active navigation and good standing.
- Red appears only for overdue, rejection, blocked standing and destructive actions, and always with an icon.
- 1px hairlines carry the structure. Shadows are barely there.
- Public Sans for all text, with Noto Sans Arabic as fallback. JetBrains Mono only for identifiers.
- Tabular figures for every count, date column and countdown.

## Colors

The palette is a restrained green-white-red institutional scheme, as the owner requested ("simple colors: green, white and red"). Every neutral carries a faint green tint (hue 150) so greys never look blue or dead next to the brand green.

### Primary
- **University Green** (#0E6B3C): primary buttons, the square brand mark in the header, the active top-nav underline, focus rings, text caret, checked controls, "available" dots and the main series in every chart. It is the only saturated hue on a typical screen.
- **Deep University Green** (#0A5230): green used as text. Active nav labels, text links ("Browse all titles", "View all"), READY and BORROWED badge text, good-standing text. Primary buttons use it as their hover state.
- **Green Wash** (#E7F2EB): the quiet green surface. Selected rows in the category filter, the mobile active-nav pill, BORROWED badges, numbered step discs on the landing page, avatar initials and non-overdue sidebar counts.

### Tertiary
- **Overdue Red** (#B42318): overdue durations, the overdue badge, blocked standing, the overdue sidebar count (solid), destructive buttons and menu items ("Sign out"), and error states. Charts use it only for the OVERDUE series.
- **Overdue Wash** (#FDEDEB): the background of the overdue badge, the "new requests blocked" banner, overdue loan cards and error panels, paired with a red border at 30% opacity.
- **Deadline Amber** (#A34A06): pickup-window countdowns and the clock icon next to them in staff queues. It means "closing soon, not yet late" and belongs to pickup windows only. A loan that is due within three days is not amber: staff Loans shows it in ink with a Clock icon, so amber keeps one meaning. Keep it for time pressure only.

### Neutral
- **Ink** (#121A16): headings, body text, table cell text. The chart axis ink.
- **Paper** (#FFFFFF): page background, panels, inputs, popovers.
- **Desk Grey** (#F5F7F6): chrome and secondary surfaces. Header demo strip, landing hero band, staff sidebar, table header rows, row hover (at 60%), count pills, footer.
- **Muted Ink** (#545F59): descriptions, metadata lines (author · year · publisher), table header text, timestamps, stat labels.
- **Hairline** (#DBE1DE): every border and divider. Panels, table rows, the header bottom edge, the sidebar edge.
- **Field Stroke** (#C8D0CC): input and select borders, one step darker than hairlines so fields read as editable.

### Named Rules
**The One Green Rule.** Green is the only accent. There are no secondary brand hues, gradients or tinted illustration colors. Book cloth colors and category swatches are content data, not brand color, and never style UI chrome.

**The Red Means Late Rule.** Red is reserved for overdue, rejected, blocked and destructive. Something that is merely important stays ink or green.

**The Never Color Alone Rule.** Every status shows an icon and a word as well as its color: an AlertTriangle for overdue, PackageCheck for ready, Clock for pending, CheckCircle2 for good standing. A red/green colorblind member must be able to read every state.

## Typography

**Display Font:** Public Sans (with Noto Sans Arabic, ui-sans-serif, system-ui)
**Body Font:** Public Sans (same stack)
**Label/Mono Font:** JetBrains Mono, for identifiers only

**Character:** Public Sans is a neutral government-grade grotesque with an institutional, trustworthy feel that reads clearly at 14 to 15px. Its only partner is a monospace for shelf marks and IDs, which staff read character by character.

### Hierarchy
- **Display** (700, 2rem rising to 2.6rem from sm, line-height 1.15, tight tracking): the landing headline only. One per product.
- **Headline** (600, 1.5rem rising to 1.75rem, tight tracking): the page title in every PageHeader ("Catalog", "Overview"). Followed by a 15px muted description capped at about 42rem.
- **Section title** (600, 1.125 to 1.25rem): h2 sections on member pages ("On the shelf now").
- **Title** (600, 15px): panel headers, book titles in lists, step titles.
- **Lead** (400, 17px, 1.6; Tailwind `text-lead`): the landing sub-headline, the author line on the book page, and the wordmark (at 700). The only step between body and the section titles.
- **Body** (400, 15px, 1.5): member-page prose, nav links, buttons.
- **Body dense** (400, 14px): table cells, metadata lines, staff lists, secondary panel copy.
- **Label** (500, 12px): table headers, badges, counts and timestamps, and the smallest text anywhere: nothing is set below 12px. The sidebar and catalog filter group headings are the one uppercase use: 12px semibold with 0.025em tracking.
- **Stat** (600, 1.75rem, line-height 1, tabular): numerals in the staff vitals strip.
- **Identifier** (JetBrains Mono 400, 13px): ISBNs, shelf marks (FIC-A-03), member ID numbers and receipt references, always `dir="ltr"`.

### Named Rules
**The Tabular Rule.** Tables, counts, stat numerals, dates in columns and countdowns use tabular figures (tables globally, the `.tabular` utility elsewhere) so digits never jitter while a countdown ticks.

**The Mono Is For Codes Rule.** JetBrains Mono appears only on machine identifiers that a person matches character by character. Never use it for labels, headings or decoration.

**The Scale Rule.** Type sizes come from the ramp above (display, headline, section title, lead, title/body, body dense, label, stat, identifier). No arbitrary sizes such as `text-[17px]`; if a new step is needed, add it to `tailwind.config.js` and to this list first.

**The Three Weights Rule.** Use 400 for reading, 500 for interactive and label text, and 600 for titles. Keep 700 for the display headline and the wordmark.

## Layout

Two containers share one header. Member pages use a centered 1280px column (max-w-7xl) with 16px gutters (24px from sm) and 32 to 40px vertical padding. The staff area widens to 1440px. Beside the content sits a 240px sidebar, sticky under the 64px header, that becomes a horizontally scrolling tab strip below lg with a trailing fade mask. Staff content pads 40px on the inline axis at lg.

Spacing follows a 4px grid. Typical steps are 12px (cell and list-row padding), 16px (panel padding, gutters), 24px (grid gaps between panels), 32px (stack between page blocks) and 56px (landing section bands). Page structure is PageHeader, then an optional vitals strip, then Panels in a two-column grid at xl (about 1.3fr and 1fr).

The landing page is search-first. The headline and a 48px search field sit beside a 26rem "How borrowing works" column of four numbered steps, set straight on the desk-grey band (no card of its own). Below that come a six-up shelf of covers (two-up on mobile) and a quiet staff band. The catalog is a 240px filter column plus a single bordered list of book rows, each with the cover, title, metadata, availability and shelf mark, and its action aligned to the end.

Mobile collapses to a single column. The top nav moves into a sheet that opens from the inline-end side (left in RTL), and panels stack. The primary action comes first on a phone: the book page runs title beside a 96px thumbnail cover, then the availability panel with Request / Join, then copies, then details; the profile opens with the library card and its QR code; catalog rows are one tap target (the title link is stretched over the row) with availability as text and no per-row button. The footer takes the same width as the header, so on staff pages it lines up with the 1440px shell.

## Elevation & Depth

The system is flat and uses hairlines. Depth comes from 1px borders and from the paper/desk-grey tonal step, not from shadows. Shadows that do appear are cool-ink tinted (rgb 16 24 20), at 8% opacity or less, and no more than 8px of blur. They only lift a surface a hair off the page.

### Shadow Vocabulary
- **Hairline lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): outline buttons and inputs (Tailwind `shadow-xs`).
- **Selected tab** (`box-shadow: 0 1px 2px rgb(16 24 20 / 0.08)` plus a 1px hairline ring): the active staff sidebar item, a white tab raised out of the grey sidebar.
- **Resting card** (`box-shadow: 0 1px 3px rgb(16 24 20 / 0.06)`): stand-alone cards on grey, such as the auth card and toasts.
- **Object** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.12)`): book covers only, so a binding reads as a physical object.
- **Overlay** (shadcn `shadow-md` / `shadow-lg`): dropdowns, dialogs and sheets only.

### Named Rules
**The Hairline First Rule.** Separate things with a 1px Hairline border or divider before you consider a shadow. Panels and tables carry no shadow at all.

## Shapes

Corners are small and consistent. The base token `--radius` is 6px. Buttons, inputs, panels, tables, the vitals strip, dropdowns and the brand mark use `md` at 4px, which is the radius the build actually uses almost everywhere. Larger stand-alone cards (the auth card, the digital library card) and dialogs use `lg` at 6px. Book covers use 3px so they read as cut board, and category swatches are 2px squares. Pills (status badges, counts, avatars, step discs) are fully round. Nothing else is.

Borders are always 1px. Tables are divided by row rules only, with no vertical cell rules. The vitals strip is a single bordered block divided by internal hairlines, not six separate cards.

Divergence from the direction contract: the contract named a 6px radius. The build settled on 4px for everyday controls and panels and kept 6px for larger cards and dialogs. The build governs.

## Components

### Buttons
Direct and quiet. One green filled button per action group.
- **Shape:** gently squared (4px).
- **Primary:** University Green fill, white 15px/500 text, 44px tall with 20px inline padding. `lg` is 48px (the hero search) and `sm` is 36px at 14px (row and panel actions).
- **Hover / Focus:** fill darkens to 90%. Focus shows a 3px ring at 50% ring-green. The global `:focus-visible` style is a 2px green outline offset by 2px.
- **Outline:** white, hairline border, hairline-lift shadow. Hover turns it Green Wash with deep-green text. Used for secondary actions ("Join waiting list", "Run scheduled checks", "Staff sign in").
- **Ghost:** no chrome until hover (Green Wash). Header "Sign in" and icon buttons.
- **Destructive:** Overdue Red fill, white text. Only for delete, reject and similar confirmations.
- **Icon buttons:** 36 to 40px square, 4px radius, 75% ink icon that darkens on a desk-grey hover. Icons are Lucide at 18 to 20px.

### Chips and badges
- **Status badge:** a full pill with a 1px border, 12px/500 text, a 14px leading icon and 2px by 10px padding. PENDING is grey. READY is white with a 40% green border and deep-green text. BORROWED is Green Wash with deep-green text. RETURNED, REJECTED and CANCELLED are white and muted. OVERDUE is Overdue Wash with red text and a 30% red border.
- **Count pill:** a tabular 12px number in a rounded pill, on desk grey (panel headers), Green Wash (sidebar queues) or solid red (overdue queue, unread notifications).

### Cards / Containers
- **Panel:** the workhorse container. White, 4px radius, hairline border, no shadow. It has a 48px-minimum header row with a 15px semibold title, an optional count pill and actions at the end, above a bottom hairline. The body pads 16px, or is flush for lists and tables.
- **Vitals strip:** one bordered block of 2, 3 or 6 columns (by breakpoint), each cell a link. Muted 14px label over a 1.75rem tabular stat in ink, or in red when it counts something late. Hover turns the cell desk grey.
- **Empty state:** centered, a 32px muted Lucide icon, a 15px/500 title and a muted line.
- **Error state:** Overdue Wash block with a 30% red border, an AlertCircle icon and a white outline Retry button.

### Inputs / Fields
- **Style:** white fill, 1px Field Stroke border, 4px radius, 44px tall (40px in filter rails, 48px for the hero search), 14px inline padding, 15px text from md (16px on mobile to avoid iOS zoom). Search fields carry a leading muted Lucide Search icon at the inline start.
- **Focus:** the border turns green and a 3px green ring at 20 to 50% appears. No glow.
- **Error / Disabled:** `aria-invalid` gives a red border and a faint red ring. Disabled drops to 50% opacity.
- **Labels:** 14px/500 ink, above the field, 8px gap.

### Navigation
- **Header:** 64px, white at 95% with backdrop blur, and a bottom hairline. From the start edge it holds the brand mark (a 36px green square with a white Lucide LibraryBig icon, then the wordmark "LibBorrow" in 17px bold over "University Library" in muted 12px), then the top nav. At the end it holds the language switcher, cart, notifications and account.
- **Top nav:** 15px/500 links at 70% ink. The active link turns deep green and gets a 2px green underline bar sitting on the header's bottom edge.
- **Staff sidebar:** desk-grey rail. Groups (Circulation, Collection, Records) have the small uppercase group heading, and items are 15px/500 with an 18px Lucide icon. The active item becomes a white tab with the selected-tab shadow and hairline ring. Queue items show live count pills at the end.
- **Mobile:** a sheet from the inline-end side with 15px rows. The active row is a Green Wash pill.
- **Demo strip:** a desk-grey band under the header with a green info icon, 13px muted text and an underlined deep-green reset link.

### Toasts
Transient messages use system tokens: a white surface, a hairline border, 6px radius (`lg`), the resting-card shadow and a leading 18px Lucide icon in green (success, info) or red (error). Sonner's `richColors` is off. They sit at the end of the reading direction, bottom-right in LTR and bottom-left in RTL. The Undo action is a secondary button.

### Tables
- **Style:** full width with a 640px minimum and horizontal scroll inside the panel. 40px desk-grey header row with 12px/500 muted labels aligned to the start. 14px cells with 16px by 12px padding and row hairlines. The last row has no rule. Hover gives a 60% desk-grey row.

### Book Cover (signature)
A generated library binding in the book's cloth color (muted, dark: slate, bottle green, oxblood, umber), 2:3 aspect, 3px radius, with the object shadow. A 7% darker spine hinge with a 1px light rule runs along the inline start. At md and lg sizes it shows a short white rule, the title in white semibold and the author at 85% white at the foot. At sm it is a plain cloth block. On the book page the cover is a ~96px thumbnail below md that shows the title only (no author line, never smaller than 12px) and is hidden from assistive tech, because the real title sits beside it. An uploaded image replaces it at the same geometry.

### Countdown
A live `dir="ltr"` tabular timer (HH:MM:SS) for pickup windows. Deep green on the member's own ready loans, Deadline Amber in staff "needs attention" queues, and the word "Expired" in red at zero. Overdue loans show "N days overdue" in red semibold instead.

## Do's and Don'ts

### Do:
- **Do** keep University Green (#0E6B3C) as the single accent: one filled green button per action group, green text links, green active states.
- **Do** pair every status color with a Lucide icon and a word (StatusBadge, MemberStanding).
- **Do** build staff screens from PageHeader, the vitals strip, Panel and the shared table styles, at 14px dense text with 40px header rows.
- **Do** use tabular figures for every number that sits in a column or ticks.
- **Do** set shelf marks, ISBNs and member IDs in JetBrains Mono 13px with `dir="ltr"`.
- **Do** use logical properties (start/end, ms/me, ps/pe) and flip directional arrows in RTL. Check every new screen in Arabic.
- **Do** separate content with 1px Hairline (#DBE1DE) borders and keep panels shadowless.

### Don't:
- **Don't** introduce a second accent hue, gradients, or brand color drawn from book cloth or category swatches.
- **Don't** use red for emphasis, promotion or "important". It means late, rejected, blocked or destructive.
- **Don't** use radii beyond 6px on containers or add pill shapes to anything but badges, counts, avatars and step discs.
- **Don't** add heavy or hard-offset shadows, colored glows, or shadows on panels and tables.
- **Don't** use uppercase tracked labels anywhere except navigation and filter group headings, and never as a kicker above a page or section heading.
- **Don't** use JetBrains Mono for UI labels, headings or decoration.
- **Don't** convey status by color alone. Red and green are the core palette, and a colorblind reader must still read every state.
