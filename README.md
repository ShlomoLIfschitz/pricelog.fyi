# pricelog.fyi

Landing page for [@pricelog_deals](https://t.me/pricelog_deals) — a Telegram channel that
records AliExpress prices daily and publishes a drop only when it beats the median of its
own observed history, rather than the seller-authored "was" price.

Two pages in two languages. English at `/`, Hebrew at `/he/`.

## Stack

Hand-written HTML and CSS. No build step, no dependencies, no `package.json`.

The site ships **zero JavaScript and makes zero third-party requests** — no analytics, no
tag manager, no web fonts. This is a stated commitment on the privacy page, not an
optimisation, so keep it that way: adding a font CDN or an analytics snippet would make
that page untrue. Language switching is a plain link for the same reason; automatic
detection would require script.

## Layout

```
index.html          /              en, ltr
privacy.html        /privacy       en, ltr
he/index.html       /he/           he, rtl
he/privacy.html     /he/privacy    he, rtl
styles.css          one stylesheet for both directions
og.png, og-he.png   1200x630 social preview images
tools/              build-time only, not served
```

Cloudflare Pages resolves clean URLs, so `privacy.html` is served at `/privacy` with no
configuration.

## Working on the CSS

`styles.css` uses **logical properties throughout** — `margin-inline`, `padding-inline`,
`border-inline-start`, `text-align: start`. There is no separate RTL stylesheet and there
should never be one. If you reach for `left` or `right`, the Hebrew pages will break.

Two things logical properties do *not* solve, both of which bit during the build:

- **Which side a divider goes on is a semantic choice, not a mapping.** The `.contrast`
  divider is on the inline start of every cell *after the first*, so it lands between the
  cells in both directions. On the first cell's inline start it would sit on the outer edge
  once the page flips.
- **Numbers must be marked up.** Prices, percentages and day counts inside Hebrew sentences
  are wrapped in `<span class="num" dir="ltr">` so they do not reorder.

Hebrew body text uses a Hebrew system stack and slightly looser leading, set on
`html[lang="he"]`. Monospace is applied to numerals only — no system mono face carries a
usable Hebrew design, so forcing it on Hebrew text produces an arbitrary fallback.

## Regenerating the preview images

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-og.ps1
```

Text lives in `tools/og.json`. The script writes `og.png` and `og-he.png` into the repo
root; commit the results.

## Deploying

Cloudflare Pages, connected to this repository:

- Framework preset: **None**
- Build command: **empty**
- Output directory: **`/`**

`contact@pricelog.fyi` is a Cloudflare Email Routing address that forwards to a personal
mailbox. There is no mail server in this repository.

## Before committing

Nothing in this repository should contain a local filesystem path, a machine user name, or
a personal email address. The only addresses that belong here are `contact@pricelog.fyi`
and the GitHub noreply address below.

Commits are authored with a GitHub noreply identity so a personal address is never written
into the public history:

```
git config user.name  "ShlomoLIfschitz"
git config user.email "98921504+ShlomoLIfschitz@users.noreply.github.com"
```

That setting lives in `.git/config`, which is **not** part of the tree and therefore does
not travel with a clone. **Run those two lines again after cloning this repository onto a
new machine**, before the first commit there — otherwise git falls back to the global
identity and stamps whatever address that is into a public repository, permanently.
