// Syncs the shared partials (head, nav, footer) into every page in /public,
// and writes robots.txt + sitemap.xml. No dependencies: `node tools/build.mjs`.
//
// Pages are edited in place. Anything between
//   <!-- @include name -->  and  <!-- @end name -->
// is replaced with partials/name.html on each run.
//
// Partial tokens:
//   {{root}}         relative path back to the site root ("./", "../")
//   {{siteUrl}}      absolute site URL from site.config.json (with trailing slash)
//   {{pageUrl}}      absolute URL of the current page
//   {{year}}         current year
//   {{v}}            short hash of site.css + site.js, for cache-busting
//   {{current:key}}  becomes aria-current="page" on the matching page
// A line that uses {{siteUrl}} or {{pageUrl}} is dropped while siteUrl is empty.

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const siteUrl = config.siteUrl ? config.siteUrl.replace(/\/?$/, '/') : '';
const assetVersion = createHash('sha1')
  .update(readFileSync(join(pub, 'assets/css/site.css')))
  .update(readFileSync(join(pub, 'assets/js/site.js')))
  .digest('hex')
  .slice(0, 8);

const partials = {};
const partial = (name) => (partials[name] ??= readFileSync(join(root, 'partials', `${name}.html`), 'utf8'));

function render(template, page) {
  const depth = page.path.split('/').filter(Boolean).length;
  const vars = {
    root: page.base ?? (depth ? '../'.repeat(depth) : './'),
    siteUrl,
    pageUrl: siteUrl && siteUrl + page.path,
    year: String(new Date().getFullYear()),
    v: assetVersion,
  };
  return template
    .split('\n')
    .filter((line) => siteUrl || !/\{\{(siteUrl|pageUrl)\}\}/.test(line))
    .filter((line) => !page.noindex || !line.includes('rel="canonical"'))
    .join('\n')
    .replace(/\{\{current:(\w+)\}\}/g, (_, key) => (key === page.key ? ' aria-current="page"' : ''))
    .replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

const inlineScriptHashes = new Set();

for (const page of config.pages) {
  const file = join(pub, page.file);
  const html = readFileSync(file, 'utf8').replace(
    /(<!-- @include (\w+) -->)[\s\S]*?(<!-- @end \2 -->)/g,
    (_, open, name, close) => `${open}\n${render(partial(name), page).trim()}\n${close}`
  );
  writeFileSync(file, html);
  console.log('synced', page.file);

  // Executable inline scripts (JSON-LD is data, so the CSP ignores it)
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|application\/ld\+json/.test(attrs)) continue;
    inlineScriptHashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
}

// Keep the CSP in .htaccess in step with the inline scripts above
const htaccess = join(pub, '.htaccess');
const scriptSrc = `script-src 'self' ${[...inlineScriptHashes].join(' ')};`;
writeFileSync(
  htaccess,
  readFileSync(htaccess, 'utf8').replace(/(Content-Security-Policy "[^"\n]*?)script-src [^;"\n]*;/, `$1${scriptSrc}`)
);
console.log(`CSP: ${inlineScriptHashes.size} inline script hashes`);

const robots = join(pub, 'robots.txt');
const sitemap = join(pub, 'sitemap.xml');
if (siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = config.pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url><loc>${siteUrl}${p.path}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  writeFileSync(sitemap, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  writeFileSync(robots, `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);
  console.log('wrote robots.txt + sitemap.xml');
} else {
  if (existsSync(sitemap)) rmSync(sitemap);
  writeFileSync(robots, 'User-agent: *\nAllow: /\n');
  console.log('siteUrl is empty: skipped sitemap.xml and canonical tags (set it in site.config.json)');
}
