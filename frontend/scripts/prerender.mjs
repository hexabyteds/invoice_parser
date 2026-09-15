#!/usr/bin/env node
// Snapshots the public marketing routes to static HTML after `vite build`,
// so crawlers and tools that don't execute JS (and Googlebot's first,
// non-rendered crawl pass) see real content instead of an empty
// <div id="root"></div>. Runs locally as part of `npm run build` — the
// production server needs nothing extra installed, it just receives these
// extra files inside dist/ like any other build output. See app-backend.js
// for the server-side logic that serves these instead of the raw SPA
// shell for a matching path.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");
const OUT_DIR = join(DIST_DIR, "__prerendered__");
const PORT = 4799;

// page.content() captures the DOM's *current* state, including any
// self-mutating markup — the deferred Google Fonts <link> in index.html
// flips its own media="print" to media="all" via onload once the
// stylesheet fetches. Snapshotting that post-load state would ship every
// prerendered page (served to *every* visitor for these routes, not just
// crawlers — see app-backend.js) with a permanently render-blocking font
// stylesheet, undoing the whole point of deferring it. Restore the
// original deferred markup before writing the snapshot; the onload
// handler is untouched, so real browsers still defer it correctly.
const FONT_LINK_LOADED = /(<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*")\s+media="all"\s+onload="this\.media='all'"/;
const FONT_LINK_DEFERRED = '$1 media="print" onload="this.media=\'all\'"';

// Keep in sync with public/sitemap.xml, public/robots.txt, and the public
// routes registered in src/App.jsx.
const ROUTES = [
  "/",
  "/accounting-software",
  "/invoicing-software",
  "/ai-invoice-processing",
  "/invoice-generator",
  "/features",
  "/price",
  "/contact",
  "/register",
  "/login",
  "/privacy",
  "/terms",
];

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.status) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("preview server did not start in time"));
      }
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

async function main() {
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: join(__dirname, ".."), stdio: "inherit" }
  );

  try {
    await waitForServer(`http://localhost:${PORT}/`);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    mkdirSync(OUT_DIR, { recursive: true });

    for (const route of ROUTES) {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "networkidle" });
      // useSeo() sets the real title/canonical/OG tags in a useEffect once
      // React mounts — wait for that instead of assuming networkidle alone
      // means the page has finished rendering. Not every route calls
      // useSeo (e.g. /login, /register keep the static default), so this
      // is best-effort: it resolves immediately when useSeo runs, and
      // otherwise just times out harmlessly after 5s.
      await page
        .waitForFunction(() => document.querySelector('link[rel="canonical"]') !== null, {
          timeout: 5000,
        })
        .catch(() => {});

      const html = (await page.content()).replace(FONT_LINK_LOADED, FONT_LINK_DEFERRED);
      const name = route === "/" ? "index" : route.slice(1);
      writeFileSync(join(OUT_DIR, `${name}.html`), html);
      console.log(`Prerendered ${route} -> __prerendered__/${name}.html`);
    }

    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
