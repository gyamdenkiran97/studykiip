# Design system and originality review

Two things in one document: what the visual language *is*, and an honest account
of its relationship to the reference that was given as inspiration.

---

## 1. Originality review

### The reference could not be retrieved

The brief named
`https://dribbble.com/shots/26100488-Emox-I-eCommerce-Landing-Page-Design` as
inspiration. **This environment's egress proxy blocks dribbble.com, so the shot
was never loaded, and no part of it has been seen.** Nothing was traced, sampled,
measured or adapted from it, because there was nothing on screen to adapt.

That is worth stating plainly rather than quietly: a comparison against a
reference nobody in this session has seen is not a comparison, and claiming to
have "reviewed and differentiated" from it would be a claim I cannot support.

What that changes in practice: the instruction was *inspiration only, do not
copy*. The inability to fetch it makes copying impossible and makes the design
independent by construction. What it costs is the ability to confirm the absence
of accidental convergence. **Before launch, somebody who can open the link should
put the two side by side** and check the items in §1.3. That check is outstanding.

### 1.2 What was taken from the genre, not from the shot

The design brief is "modern editorial ecommerce landing page", and there are
conventions in that genre that are simply how the web works. Using them is not
copying anyone:

| Convention | Why it is used here | How the implementation is its own |
| --- | --- | --- |
| A hero that states what the store is, above a product-led scroll | People need to know what they have landed on | The hero is an asymmetric editorial split — a serif headline set at `0.94` line-height against a single large product plate — not a centred headline over a full-bleed photograph |
| Category entry points near the top | The single most common first action in a multi-category store | Rendered as a dense, near-square tile grid with real product counts from a recursive CTE, not as decorative illustrated circles |
| Product cards in rails and grids | It is how a catalog is read | Cards are flat, borderless and near-square (`--radius-sm: 3px`), with price and rating on one wrapping row; no elevated rounded card with a shadow on hover |
| A sticky header with search and basket | Expected behaviour; removing it would be hostile | Departments open on hover *and* on focus, with a full keyboard path and Escape to close |
| A trust/benefits strip | Standard reassurance before checkout | Set as small-caps editorial text on a rule, not as three icons in circles |

### 1.3 The checklist for whoever can see the reference

Confirm none of these were arrived at independently:

- [ ] Same or near-same accent hue
- [ ] Same typeface pairing
- [ ] Same hero composition, proportions or crop
- [ ] Same section order
- [ ] Recognisable illustration, icon or photographic style
- [ ] Reused wording, taglines or brand language

If any come back positive, the item here is the one that changes.

### 1.4 The "does it look AI-generated?" test

The brief banned a specific list. Each is verifiably absent — these are
greppable, not opinions:

| Banned | Status |
| --- | --- |
| Purple/violet gradients | No purple in the palette. Accents are clay `#a8452b` and forest `#1e3a32` |
| Neon or saturated glow | Nothing above ~65% saturation; no glow shadows |
| Floating blobs / abstract shapes | None |
| Rounded cards everywhere | Largest radius token is `8px`; cards use `3px` |
| Generic AI illustrations | None — no illustration layer at all |
| Oversized pill buttons | Buttons are rectangular with a `3px` radius. `rounded-full` appears three times in the whole codebase — two radio inputs and the gallery's position dots, all of which are meant to be circles |
| Glassmorphism | Not as a style. `backdrop-blur` appears on five elements, all of them sticky bars over a background that is already 92–95% opaque (`bg-paper/95`); it keeps text legible while content scrolls under, and none of them is a translucent frosted panel used decoratively. If even that is unwanted, the five can go — the layout does not depend on them |
| Dark hero with a light gradient wash | The hero is bone-coloured paper |

The positive test matters more than the negative one: the page reads as a
printed catalogue — warm off-white ground, a serif display face, rules instead of
shadows, and a lot of deliberate whitespace. It is committed to a point of view,
which is usually what "AI-generated" design is missing.

---

## 2. The design language

**Kiip Mall is a printed catalogue rendered in a browser.** Paper ground, ink
text, hairline rules, generous margins, and photography doing the work that
gradients and glass would otherwise be asked to do.

### 2.1 Colour

Defined once as Tailwind 4 `@theme` tokens in `src/app/globals.css`. There are no
hard-coded hex values in components.

| Token | Value | Role |
| --- | --- | --- |
| `--color-paper` | `#fbf9f5` | Page ground — warm off-white, never pure `#fff` |
| `--color-paper-deep` | `#f3efe7` | Alternating sections |
| `--color-surface` | `#ffffff` | Cards and sheets that must lift off paper |
| `--color-ink` | `#14120f` | Body text — warm near-black, not `#000` |
| `--color-ink-soft` | `#3d382f` | Secondary text |
| `--color-muted` | `#6f6759` | Tertiary text |
| `--color-muted-soft` | `#746b5b` | Small labels and metadata |
| `--color-line` | `#e5e0d5` | Hairline rules |
| `--color-clay` | `#a8452b` | Primary accent — sale, primary action |
| `--color-forest` | `#1e3a32` | Secondary accent |
| `--color-gold` | `#a6802f` | Ratings |

Two accents, used sparingly. Colour carries meaning here: clay means *act on
this*, forest means *this is stable information*. Nothing is coloured decoratively.

`--color-muted-soft` is worth a note. It started at `#938a79`, which measured
**3.24:1** on paper and failed WCAG AA for the small text it was designed for.
It was darkened to `#746b5b` — **5.0:1** on paper, **4.58:1** on the deeper
surface. The design changed to meet the requirement rather than the requirement
being waived, which is the right direction for that trade.

### 2.2 Type

**Fraunces** (variable serif, optical-size axis) for display. **Instrument Sans**
for everything else. Both are open-licensed and self-hosted through
`next/font`, so there is no third-party font request and no layout shift.

Display sizes are fluid `clamp()` values with tight line-heights (`0.94` at the
largest) and negative tracking — the settings a print designer would use for a
cover line, and the reason the page reads as editorial rather than as a
dashboard. Body text stays at comfortable sans-serif defaults; the drama is
confined to headings.

The `.eyebrow` class — `0.6875rem`, `0.18em` tracking, uppercase — is the
recurring small-caps label that ties sections together.

### 2.3 Space, shape and depth

Radii top out at `8px` and are `3px` almost everywhere. Images are square or
`4:5`, never rounded. This one decision does more than any other to keep the
page from looking like every other template.

Depth comes from **rules and ground changes**, not shadows. Two shadow tokens
exist for genuinely floating surfaces (dropdowns, the basket drawer) and are low,
warm and wide rather than the default grey blur.

### 2.4 Motion

Slow and few. One easing curve (`--ease-out-soft`, `cubic-bezier(0.22, 1, 0.36, 1)`),
long durations (850ms for reveals), and only three effects: rise, fade and a
clip-path mask.

`prefers-reduced-motion: reduce` is honoured properly — content renders in its
final state immediately, rather than animating faster. `Reveal` checks the media
query before it ever sets the hidden state, so a reduced-motion visitor never
sees a flash of invisible content. There is an E2E test asserting exactly that.

One implementation detail is load-bearing: the observed element and the animated
element are **separate**. A `clip-path` that hides a node also collapses the
rectangle `IntersectionObserver` measures, so observing the clipped node means it
can never intersect and the reveal never fires. The outer element keeps its
natural box; the inner one carries the effect.

### 2.5 3D

One React Three Fiber scene, and it is subordinate to the shop:

- Dynamically imported, so it is not in the initial bundle.
- Gated on viewport, screen size, `prefers-reduced-motion`, CPU core count and
  WebGL support. Any failure renders a static image instead.
- No HDR environment map or any other runtime network fetch — lighting is
  hemisphere plus point lights. (It originally used `<Environment>`, which
  fetched an HDR from a CDN; that was a hard dependency on a third party for a
  decorative effect, so it was removed.)
- It appears on one page and is never between a customer and a purchase.

---

## 3. Mobile

Mobile layouts are designed, not scaled. The header collapses to a sheet with
department accordions rather than a shrunken mega-menu; the hero reorders so the
product plate leads; product grids go two-up with a tighter type scale; filters
become a bottom sheet with an explicit apply action; and the basket summary
sticks to the bottom of the viewport where a thumb is.

Verified with no horizontal overflow at 360, 390, 393, 430, 768, 1024, 1280,
1440 and 1920 px. Two overflow bugs found during that pass were fixed in the
layout — a `max-content` single-column grid and a price row that could not
wrap — rather than by hiding overflow.

---

## 4. Accessibility, as a design constraint

Treated as part of the design rather than a pass afterwards:

- Every text/background pair meets WCAG AA. The one that did not was changed.
- Focus is visible everywhere and never removed — a ring in ink over a paper
  offset, so it reads on both grounds.
- Colour never carries meaning alone. Sale badges have text; form errors have
  `role="alert"` text and an `aria-describedby` link to the field.
- Every interactive element has an accessible name; icon-only buttons carry
  visually hidden labels.
- Hover-revealed navigation is also focus-revealed and Escape-dismissible.
- axe (WCAG 2.1/2.2 A + AA) reports zero violations across eight storefront
  pages and the admin dashboard.

---

## 5. Changing it

Change the tokens in `src/app/globals.css`, not the components. A different
palette or type pairing is a token edit; that is the whole point of defining them
in one place. The two rules to keep if the brand changes: **keep radii small**,
and **keep accents to two**. Those are what make it look like a considered shop
rather than a template.
