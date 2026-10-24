# Skaha Lake Pharmacy website

A static site in plain HTML, CSS and a small amount of JavaScript. There's no framework and no build step is needed on the server.

## Deploying (FTP)

Upload **the contents of `public/`** to the web root (usually `public_html/`). That's the whole site. Include the hidden `.htaccess` file; some FTP clients hide dotfiles by default.

```
public/
  index.html               Home              → /
  about/index.html         About             → /about/
  order-online/index.html  How to order      → /order-online/
  404.html                 Not-found page
  .htaccess                404 page, compression, caching (Apache/cPanel)
  robots.txt, sitemap.xml  (sitemap appears once siteUrl is set)
  favicon.svg, apple-touch-icon.png, site.webmanifest
  assets/css/site.css      All styles
  assets/js/site.js        Menu, reveals, live "open now" hours, video
  assets/img/              Images, logo, icon sprite
```

The site expects to live at the domain root (e.g. `https://example.ca/`). Inner pages use relative links. The 404 page uses root links, because it can be served at any URL.

## Editing

Edit the page files in `public/` directly. The **head, nav and footer** are shared: edit them in `partials/` and then run:

```
node tools/build.mjs
```

This copies the partials into every page, between the `<!-- @include … -->` and `<!-- @end … -->` markers. It also refreshes the cache-busting hash on the CSS and JS, and writes `robots.txt` and `sitemap.xml`. It needs Node 18+ and has no dependencies.

### Before launch: set the domain

Put the live domain in `site.config.json`:

```json
{ "siteUrl": "https://www.your-domain.ca" }
```

Then run `node tools/build.mjs`. This adds canonical tags, absolute share-image URLs, the schema `url`, and a `sitemap.xml`. Then:

- Uncomment the HTTPS redirect in `public/.htaccess` once SSL is active.
- Submit `sitemap.xml` in Google Search Console.

### Opening hours

Hours appear in three places. Keep them in sync:

1. `partials/footer.html`: the visible table.
2. `public/assets/js/site.js`: `HOURS` drives the live "Open now / Closed" status. BC statutory holidays are calculated automatically.
3. `partials/head.html`: `openingHoursSpecification` in the schema, which Google reads.

## Details worth knowing

- **Page transitions** use cross-document View Transitions (CSS only). Chrome, Edge and Safari 18+ get a soft cross-fade with the nav held in place. Other browsers navigate normally.
- **Instant navigation**: Speculation Rules prerender a page when someone hovers a link (Chrome/Edge).
- **Video** loads YouTube (privacy-enhanced domain) only after someone presses play.
- **Motion** respects the visitor's "reduce motion" setting. Content is never hidden if JavaScript fails.
- **Fonts**: Inter is loaded from Google Fonts. To self-host instead, download the Inter variable woff2, add an `@font-face` to `site.css`, and remove the two Google lines from `partials/head.html`.

## Re-rendering the share image / touch icon

`tools/og.html` and `tools/touch-icon.html` are templates. Render them with headless Chrome:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=og.png tools/og.html
```

Then convert to JPEG as `public/assets/img/og-image.jpg`.

## Local preview

```
python3 -m http.server 4321 --directory public
```
