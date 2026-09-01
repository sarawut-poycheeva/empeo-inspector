# Dev Inspectors

Chrome extension with three lenses for front-end work on the Gofive platform.

**Colors** — paste a hex or a `box-shadow`, get the token you should be using, plus the light
and dark value and whether a utility class exists or only a CSS variable.

**Icons** — search 1,200+ icons by name and see the real glyph, with a per-environment badge
showing whether each one has shipped to dev, uat and prod yet.

**Redirect** — point a deployed Module Federation bundle at your local build, several at once,
each with its own port and toggle.

All three answer questions that cost real time: *which `go5-` class is this colour from a design
file*, *has the icon someone added actually been deployed*, and *does my change work against real
UAT data before I deploy it*.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome: **Extensions → Developer mode → Load unpacked → pick the `dist/` folder.**

`dist/` is committed, so a teammate can `git pull` and load it without installing anything.

> If you change `manifest.json`, use **Remove** then **Load unpacked** again. Chrome's
> *Reload* button does not reliably re-read a changed manifest.

## Colors lens

| | |
|---|---|
| Paste a hex | exact matches only — if the colour is not in the system, it says so |
| Paste a `box-shadow` | matched against the three DS shadows |
| Type a name | `text-color-8`, `primary`, `--go5-bg-secondary`, `.go5-color-primary` |
| **Pick a colour** | eyedropper — grabs any pixel on screen, including outside the browser |
| Result card | the usage string, `class` or `var()`, and both light + dark values |
| Token list | grouped by dropdown, one mode at a time so rows stay readable |
| Click anything | copies the usage string |

Switching brand re-tints the popup with that brand's primary, so it is obvious which theme
the values belong to.

### Why exact only, for a hex

An earlier build answered with the nearest token when nothing matched exactly, reasoning that
colours lifted from a design file are routinely a digit or two off — `#F05B30` is 2 away from
`--go5-color-primary`, which is almost certainly what was meant.

The reasoning was right and the behaviour was still wrong. A near hit renders in the same card as
a real answer, so it reads as *use this*; acting on it means shipping a token that is not the
colour you were handed, with the tool's blessing. "Not in the system" sends you to ask the
designer, which is the correct next step when a colour genuinely is not there.

Shadows still report a closest match, because a shadow is five numbers and being told which DS
shadow is nearest is the actual question — but it is labelled `closest`, never presented as the
answer.

### Translucent tokens are matched by what they render as

Exact-only has one failure mode that is not the designer's fault and not yours: **a token with
alpha never renders as its own value.** `tag-default-bg` is `#F05B2F1A`, but the pixel on an
empeo-dark page is `#322223`. Comparing the stored value against a picked one puts those 100
units apart — not a near miss the ranking could have rescued, just nothing at all. It read as the
lens being broken, and for that quarter of the set it was.

So a translucent token is compared as what it composites to over the page surfaces (`bg-primary`
and `bg-secondary`, per theme), and the hit is tagged `10% over #1C1C22` — the alpha is the half
you have to write down anyway. Still an exact match, still nothing invented.

Only those two surfaces. Compositing over every opaque token in the set would produce a hit for
almost any input, and the whole value of exact-only is that *not* finding something means
something.

`rgba()`, `rgb(r g b / n%)` and `rgba(from var(--x) r g b / n)` are parsed too — hex-only parsing
had been skipping them in silence, which is worse than failing, because nothing said those tokens
existed. Of 846 values the lens can now reach 763, up from 734. What is left is honest: 56
`transparent`, 6 gradients, and the 21 malformed hexes DS ships (see below), which CSS drops
anyway.

### The eyedropper

The eyedropper reads **one composited pixel**. It has no idea which element the pixel came
from, so it can answer *which token is this colour* and nothing else — not the shadow, not the
class, not the font.

What pulls a reading away from the authored colour, in the order it actually bites:

- **Alpha.** Handled now, per the section above — but only for a token's own alpha. A parent
  `opacity`, a hover state or a scrim stacks on top of that and is not modelled.
- **Picking from a screenshot on a wide-gamut display.** macOS tags the file with the display
  profile, so the value you read is the P3 rendering of an sRGB colour: off by 1–4 per channel,
  consistently, for every colour on the page. Pick the same swatch live and from a screenshot; if
  they disagree, this is why.
- **An image that went through Slack or Line.** Re-encoded as JPEG, and chroma subsampling moves
  colours near any edge.
- **Anti-aliasing.** The edge of a glyph, a 1px border or a rounded corner is a blend with
  whatever is behind it. Aim at the middle of a thick stroke.
- **Zoom that is not 100%, or a fractional device pixel ratio.** The browser interpolates, and
  interpolated pixels are averages of two colours.
- **Gradients and shadows.** Real, and the smallest of these — a gradient has no single colour to
  match, so `nav-background` cannot be found by picking off the nav bar.

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

## Icons lens

Search by name (`asset`, `star`, `upload`) or by codepoint (`e907`). Click a card to copy the
class name. Every card carries three badges — dev / uat / prod — and cards missing from an
environment are outlined, so *has my icon deployed yet* is answered at a glance. The
**Mismatched** filter narrows to exactly those — meaning present on some environments and not
others. A codepoint that differs between environments is not a mismatch and never counted as
one; see below for why.

### What the last release added

The other half of the deploy question — *what did anyone add?* — needs no name to search for.
Additions are marked `NEW`, counted in the header and selectable with the **New** filter.

What gets flagged is **the most recent change**, not everything since you last looked. Those are
different questions and the second one has no useful answer: it grows with every release nobody
dismissed, so three deploys later `5 New` describes an interval, not a release. The anchor moves
on every sync, which makes each round exactly one deploy's worth.

A sync that finds nothing carries the round forward untouched — otherwise the flag would only
ever be visible to whoever happened to open the popup between a deploy and the next sync, which
is nobody. Clicking `N New ✓` acknowledges the round without touching the anchor; the next real
change flags itself again.

Two consequences worth knowing. A release you never synced through is folded into the next one,
because the extension can only diff what it has actually seen. And the first run adopts the
current set silently rather than announcing 1,205 new icons — which also means removing and
reinstalling the extension wipes the history, absorbing whatever was pending.

Only additions are reported. A removal breaks code that still references the class, which
matters more, but it cannot be drawn as a card — there is no glyph left — so it belongs to a
different feature rather than a silent half of this one.

### Keyboard

`↓` from the search box enters the grid, arrows move in two dimensions (the column count is read
from the resolved CSS grid, so it is right in both views), `Home`/`End` jump to the ends, `↑`
from the first row returns to the search box, and typing any character goes straight back to
searching. Enter and Space copy, which already worked — every icon is a real `<button>`.

### Two views

Same search: **cards** name each icon with its codepoint and environments, **grid**
drops to glyph-only tiles so the whole set fits on a few scrolls — for when you are looking for
a shape you half-remember rather than a name you know. The outline still marks anything not on
every environment, and the tooltip names which one is missing. The choice is remembered.

The three hosts are fixed, taken from `gofiveCoreWeb.baseUrl` in the consuming apps'
`environment.*.ts`. The lens does not look at the tab you have open — it has no permission to,
and comparing all three at once is what answers the deploy question anyway. Local development
also points at `apps-dev`, so the dev column covers it.

Unlike colours there is no build-time snapshot: the icon assets exist only on the asset CDN,
with no copy in any repo we have. The lens fetches `assets/icons/go5-icon/style.css` from all
three environments on open and paints from the previous snapshot in `localStorage` first so it
is never blank. New icons therefore appear without rebuilding the extension.

Each environment also reports when it last shipped the set, read from the `Last-Modified` header
(CORS-safelisted, so it is readable cross-origin). **Sync** re-fetches past every cache when you
do not trust what you are seeing.

### The stylesheet is served immutable, which nearly made this lie

`cache-control: public, max-age=31536000, immutable` means a default `fetch` is answered from
the browser cache **without contacting the server, for a year**. For a lens whose entire job is
"has this shipped yet", that guarantees a stale answer — and it is why the app itself appends
`?v=<timestamp>` when it loads the same file.

The first build of this lens got that wrong and showed a count for dev that no longer existed on
the server. Fetches now pass `cache: "no-cache"`, which forces revalidation so the ETag still
saves the response body on a 304 but the answer is never stale; **Sync** uses `cache: "reload"`
to skip the cache entirely.

The font is loaded straight from the CDN too. Both it and the stylesheet answer
`access-control-allow-origin: *`, and MV3's default CSP leaves `font-src` open, so this needs
no host permission.

### Identity is the class name, never the codepoint

Inserting one glyph shifts the slot of every icon after it. A single addition on uat made
**1,128 of 1,204** icons compare as "different" from dev when matched by codepoint — every one
of them false. Merging is by name for that reason, and the same fact means application code
must never reference `content: "\e907"` directly; only the class name is stable across a
deploy.

### Two things the set itself gets wrong

The folder is `assets/icons/go5-icon/` but every class is `gf-icon-*`, so grepping the codebase
for `go5-icon` finds nothing at all.

The design system's own `icons-story.component.ts` hardcodes a list of **18** icons and has no
search — a component demo rather than a gallery, covering 1.5% of what exists.

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

## Redirect lens

Ported from the `empeo-requestly` extension, which replaced doing this one rule at a time in
Requestly itself. Type `empeo-learn/main.js`, or paste the whole URL out of the Network panel,
and every request whose URL contains that substring is served from `http://localhost:<port>`
instead.

| | |
|---|---|
| Match | substring, host-agnostic — one entry covers dev, uat and prod |
| Rewrite | scheme, host and port only; the path is preserved by DNR `transform` |
| Port | per entry, so two modules can be served from two dev servers at once |
| Toggle | per entry, plus one master switch that empties the rule set without losing the list |
| Toolbar badge | how many redirects are armed |

### What changed from the original

**Per-entry port.** One fixed port is fine until you need two modules at the same time, and
you cannot serve two `dist/` folders from one `lite-server`. The port is inline on the row.

**A pasted URL is accepted.** What people have to hand is the URL from DevTools, not the
substring. The origin, the leading slash and the `?v=…` cache buster are all stripped — leaving
the cache buster in would pin the rule to one build and look like the redirect simply failed.

**A badge on the toolbar icon.** The expensive mistake with this tool is forgetting a redirect
is on: the page quietly serves a stale local build and the next hour goes into debugging a
ghost. The count is visible without opening anything.

**A reachability dot per row.** The second expensive mistake is a redirect pointing at a server
that was never started. The dot says whether the port answered — and only that: a `no-cors`
request cannot read a status, so a 404 and a 200 are indistinguishable. Port open is still the
failure worth catching.

**Scan page.** Typing the path is where this lens goes wrong: one wrong character matches
nothing, silently. `Scan page` reads `performance.getEntriesByType("resource")` out of the tab you
opened the popup on and lists the Module Federation entry points it actually fetched — `main.js`,
`remoteEntry.js`, `polyfills.js` — each with an `+ Add`. Hashed webpack chunks are dropped: they
are worthless as a rule, since the name changes every build.

A bare `main.js` at the root is never offered, even though pages do load such files. It would
match every module on every host and send them all to one port, breaking the page in a way that
looks nothing like a redirect problem.

This is the one place the extension reads from a page, and it needs `scripting` + `activeTab`.
`activeTab` is granted by the click that opened the popup, covers only that tab, and lapses when
it navigates — so there is still no standing access to page content, and no content script.

**`on this page`.** Armed and *actually fired here* are different questions, and only the second
one answers "is this module really coming from my machine". Chrome keeps a per-tab log of matched
rules, read with `getMatchedRules`; the rule ids in it are the entry ids, since `buildDnrRule`
uses one as the other. Only the tab id is used, so this needs no `tabs` permission — that one
gates the url and title, which are none of this lens's business.

Two things it cannot tell you. The log only holds requests that already happened, so arming a
rule while the page is open shows nothing until a reload — correct, but easy to read as broken.
And it is cleared when the tab navigates, so an empty list means "not since this page loaded",
never "your rule is wrong".

### Why the rules live in the service worker

The popup only writes `chrome.storage.local`; `background.js` watches storage and rebuilds the
entire dynamic rule set in one atomic `updateDynamicRules` call. Two consequences: the live rules
cannot drift from the list you are looking at, and a popup closed mid-edit cannot leave a stale
redirect running.

`chrome.storage.local` rather than `localStorage`, because a service worker cannot read a page's
`localStorage` — the other two lenses keep using `localStorage` for their own view preferences,
which the worker has no business knowing.

## Screens lens — built, and switched off

> **Not in the shipped build.** `SCREENS_ENABLED` in `src/popup/popup.ts` is `false`, so the tab
> is hidden and nothing here can run. Flip it to `true` and rebuild; the panel, the overlay and
> `content.js` are all still wired, and that constant is the only switch.
>
> It is off because it has never been opened against a real portal. It builds, it is typed and its
> logic is covered by tests — none of which can answer the two questions at the end of this
> section, and a lens that might show five login screens is worse than no lens.

What it does: renders the page you are on at several widths at once. Pick the sizes in the popup,
press **Open on this page**; Esc closes it, and so does opening it again.

The design notes below are kept because they are the reasoning to re-check, not to re-derive, when
someone picks this up.

### It renders in your tab, not in a viewer tab of its own

This is the whole design, and it is one decision rather than three. The obvious build — a viewer
page of our own at `chrome-extension://…` — makes the top-level document ours, and that costs:

| | In a viewer tab | In your tab |
|---|---|---|
| `X-Frame-Options: SAMEORIGIN` | rejects the frames; needs a DNR rule stripping response headers | passes, because the frames are same-origin |
| cookies | request is now cross-site, so `SameSite` cookies stop being sent | sent normally |
| `sessionStorage` | scoped to the tab, so a new tab starts empty | already holds the token |

That third row is decisive here. Both empeo and core-web keep `access_token` in `sessionStorage`
(`auth.service.ts`, `master.service.ts`), and `sessionStorage` is per-tab. A viewer tab would show
five login screens. Staying in the tab means the frames read the token the app already put there.

Same-origin also buys scroll sync for free: the overlay can reach `iframe.contentDocument` and
listen directly. Across origins that would need `postMessage` and cooperation from the app.

### Sync scrolls by fraction, not by pixels

A 390px column of the same content is far taller than a 1440px grid of it, so matching `scrollTop`
puts one frame halfway down while another is at the end — and layouts diverging is the only reason
to have opened this. Each frame reports how far through its own length it is, and the others go to
the same fraction.

### It lives in a shadow root

The host page is a full design system with a `*` reset and its own z-index ladder. An overlay in
the light DOM inherits all of it and loses. Everything is inside `attachShadow`, and the host
carries `all: initial` so nothing leaks in either direction.

### The two questions that keep it switched off

Neither can be settled without a logged-in portal, and both change what this should become:

- **Does the session survive?** If a frame lands on the login screen, the `sessionStorage`
  reasoning above is wrong and the lens needs a different approach.
- **Do five Angular apps coexist in one tab?** Each frame boots the app again, and Module
  Federation shares singletons across a container. If they collide, that sets the ceiling on how
  many frames the rail can hold. `uat-dev` also ships a 62 MB bundle — prefer `uat` for this.

## Layout

```
scripts/extract-tokens.mjs     generator — reads the DS repo
src/shared/tokens.ts           colour + shadow matching
src/shared/tokens.generated.ts generated colour data (do not edit)
src/shared/icons.ts            icon stylesheet parsing and cross-env merging
src/shared/redirect.ts         path normalising and DNR rule building
src/shared/screens.ts          device presets, scroll-sync and frame maths (off)
src/background.ts              service worker: storage → redirect rules
src/content.ts                 the Screens overlay, injected on demand (off)
src/popup/                     the popup: index.html, popup.css, popup.ts
test/                          73 tests over the three live lenses and Screens
dist/                          built output, committed for distribution
```

```bash
npm test          # node --test, TypeScript stripped at runtime, no build step
npm run typecheck
npm run watch     # rebuild on save
```

## Permissions

The colours and icons lenses need none at all. The redirect lens changes that, and the cost is
worth stating plainly rather than burying in the manifest:

| | Why |
|---|---|
| `declarativeNetRequest` | the redirect itself |
| `declarativeNetRequestFeedback` | reading Chrome's log of which rules matched, for `on this page` |
| `scripting` + `activeTab` | `Scan page` — reading the resource list out of the tab you opened the popup on, and nothing else (`Screens` would also use it, but it is switched off) |
| `storage` | the popup and the service worker have to share one rule list |
| `host_permissions: <all_urls>` | a DNR redirect action needs host access **for the request being redirected**, and the whole point is that one entry covers dev, uat and prod |

`<all_urls>` is the expensive one. Chrome will describe this extension as able to read and change
your data on all sites, and that description is fair: DNR is declarative and this build never
reads a response body, but the permission granted is broad regardless. Before, the answer to
"what can it see" was "nothing"; now it is "it could see everything, and does not".

If that trade is not worth it, remove `background.js`, those three manifest keys and the Redirect
tab — the other two lenses go back to needing zero permissions.

Colour data is bundled into the popup. Icon data is fetched from the asset CDN, possible without
a host permission of its own because that CDN sends `access-control-allow-origin: *`.

The only page access in the shipped build is `Scan page`, which reads the resource-timing list
from the tab you opened the popup on. There is no content script and nothing is written to a page.

`Screens` would change that — it appends an element and injects a script, the first thing here
that writes to a page at all — but it is behind `SCREENS_ENABLED` and cannot be reached. The
statement above holds as long as that flag is `false`; turning it on means revising this section,
not just the feature.

## Not in this version

Deliberately left out to keep the tool one job wide:

- **Hover inspection / page scanning.** Reporting what an element actually uses needs a content
  script and, because a popup closes the moment focus leaves it, a side panel. Earlier drafts
  exist; they are a separate lens, not this one.
- **Contrast checking.** The data is already here for it, so this is the cheapest thing to add
  next if anyone asks.