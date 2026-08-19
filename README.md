# Gofive DS Colors

Chrome extension. Paste a hex or a `box-shadow` value, get the design system token you should
be using — plus the light and dark value, and whether there is a utility class or only a
CSS variable.

Built for the case that costs the most time in practice: you have a colour from a design file
and no fast way to tell which `go5-` class it belongs to.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome: **Extensions → Developer mode → Load unpacked → pick the `dist/` folder.**

`dist/` is committed, so a teammate can `git pull` and load it without installing anything.

> If you change `manifest.json`, use **Remove** then **Load unpacked** again. Chrome's
> *Reload* button does not reliably re-read a changed manifest.

## What it does

| | |
|---|---|
| Paste a hex | ranked matches, exact first; if nothing is exact it shows the nearest with a `Δ` |
| Paste a `box-shadow` | matched against the three DS shadows |
| Type a name | `text-color-8`, `primary`, `--go5-bg-secondary`, `.go5-color-primary` |
| **Pick a colour** | eyedropper — grabs any pixel on screen, including outside the browser |
| Result card | the usage string, `class` or `var()`, and both light + dark values |
| Token list | grouped by dropdown, one mode at a time so rows stay readable |
| Click anything | copies the usage string |

Switching brand re-tints the popup with that brand's primary, so it is obvious which theme
the values belong to.

### Why "nearest" and not just exact

Colours lifted from a design file are routinely a digit or two off. `#F05B30` is not in the
system, but it is 2 away from `--go5-color-primary`, which is almost certainly what was meant.
Exact-only matching fails on the common case.

### The eyedropper

The eyedropper reads **one composited pixel**. It has no idea which element the pixel came
from, so it can answer *which token is this colour* and nothing else — not the shadow, not the
class, not the font. Two things to keep in mind:

- The value is what is on screen **after blending**. Opacity, an overlapping shadow or a
  translucent overlay all pull it away from the authored colour.
- Text is anti-aliased, so the edge of a glyph is a blend with whatever sits behind it. Aim at
  the middle of a thick stroke, or expect a near miss rather than an exact one.

Its real advantage is reach: it picks from anywhere on screen, a design tool or an image
included, which nothing else here can do.

The button hides itself on Chrome versions without `window.EyeDropper`.

**One risk is known but unconfirmed.** Chrome dismisses a toolbar popup when it loses focus, and
the eyedropper draws its own full-screen overlay. If the popup is torn down mid-pick the promise
never settles and the colour is gone — nothing inside a destroyed context can recover it.
Whether it actually happens depends on the Chrome build, so nothing has been built around it.
If a pick is ever seen to fail this way the fix is to move the picking into a side panel or a
content script, both of which are larger changes than the problem currently justifies.

### Why it says `class` or `var()`

Only 27 of the 126 tokens ship a utility class. The rest exist as CSS variables and have to be
used from SCSS. Answering with a class name that does not exist is worse than answering nothing.

## Keeping the values honest

The token table is generated from the design system's own sources, never hand-copied:

```bash
npm run tokens                          # expects ../library-design-system
npm run tokens -- /path/to/library-design-system
```

It reads:

- `projects/base/api/theme-*.ts` — every theme's values, chasing `var(--go5-…)` references
  until they land on a real value
- `projects/base/assets/styles/components/_text.scss` — classes written literally
- `projects/base/assets/styles/components/_color.scss` — classes generated with `@each`
  (grepping for `.go5-color-primary` finds nothing even though the class is real)

Output goes to `src/shared/tokens.generated.ts`. **Re-run it after bumping
`@gofive/design-system-base`, then `npm run build`.** A stale table is worse than no table —
it answers confidently and wrongly.

Current snapshot: 126 tokens, 7 themes, 27 with a utility class.

## Things the data revealed

**The text ramp is an exact mirror.** `text-color-1` is `#FFFFFF` in light and `#1C1C22` in
dark; `text-color-12` is the reverse, and so is every step between. Use the ramp by meaning and
dark mode is correct with no `prefers-color-scheme` override.

**Hardcoding a shadow breaks dark mode silently.** All three DS shadows switch to
`rgba(255, 255, 255, …)` in dark themes, because a black shadow on a dark surface is invisible.
`box-shadow: 0 0 8px 0 rgba(0,0,0,0.08)` is right in light and gone in dark;
`var(--go5-shadow-soft)` handles both.

**`box-shadow` cannot be compared as a string.** Chrome serialises it as
`rgba(0, 0, 0, 0.08) 0px 0px 8px 0px` — colour first, units added — while CSS is authored with
the colour last. `parseShadow` splits it into five parts and compares numerically.

**Three feature colours in DS hold malformed hex** — `customer: "#4ca32"`,
`salesorder: "#116df"`, `conversation: "#116df"` are five digits and quoted, so CSS drops the
declaration and the class paints nothing. `#116df` looks like `#116DFC` with the last character
lost; `#4ca32` is not guessable. `npm run tokens` warns about these, and the popup tags them.
Worth raising with the DS team.

**`custom-light` declares no shadow tokens at all**, so `var(--go5-shadow-soft)` resolves to
nothing for tenants on that theme.

## Layout

```
scripts/extract-tokens.mjs     generator — reads the DS repo
src/shared/tokens.ts           types, matching, distance functions
src/shared/tokens.generated.ts generated data (do not edit)
src/popup/                     the popup: index.html, popup.css, popup.ts
test/tokens.test.ts            15 tests over the matching logic
dist/                          built output, committed for distribution
```

```bash
npm test          # node --test, TypeScript stripped at runtime, no build step
npm run typecheck
npm run watch     # rebuild on save
```

## Permissions

None. No `permissions`, no `host_permissions`, no content script, no background worker — the
popup only reads data bundled into itself. Nothing is read from or written to any page.

## Not in this version

Deliberately left out to keep the tool one job wide:

- **Hover inspection / page scanning.** Reporting what an element actually uses needs a content
  script and, because a popup closes the moment focus leaves it, a side panel. Earlier drafts
  exist; they are a separate lens, not this one.
- **Contrast checking.** The data is already here for it, so this is the cheapest thing to add
  next if anyone asks.