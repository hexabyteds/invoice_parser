import { useEffect } from "react";
import { SITE_URL } from "../utils/seo";

function upsertMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href) {
  let tag = document.head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function removeMeta(attr, key) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

// Sets per-route <title>, meta description, canonical, and OG/Twitter tags.
// No react-helmet-async in this project — this is a small, dependency-free
// stand-in scoped to what the marketing pages actually need. If routes start
// needing SSR or a lot more head management, that's the point to reach for
// a real library instead of growing this further.
export function useSeo({ title, description, path, image = "/og-image.png", robots }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | EazeeBooks` : "EazeeBooks";
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;

    upsertMeta("name", "description", description);
    upsertCanonical(url);

    // Reachable, real pages (not blocked in robots.txt — Google must be
    // able to crawl a page to see this tag at all) that shouldn't appear
    // in search results, e.g. /login and /register. Omit `robots` for
    // every normal indexable page — this only adds the tag when a page
    // explicitly opts into it, and removes it if a route ever stops
    // passing one after previously setting it.
    if (robots) {
      upsertMeta("name", "robots", robots);
    } else {
      removeMeta("name", "robots");
    }

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "EazeeBooks");

    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);

    // Defaults to the site-wide brand card (public/og-image.png); pass
    // `image` explicitly to override it for a specific page.
    if (image) {
      const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;
      upsertMeta("property", "og:image", imageUrl);
      upsertMeta("name", "twitter:image", imageUrl);
    }
  }, [title, description, path, image, robots]);
}

// Injects a single JSON-LD <script> block, scoped to the page that calls it
// and removed on unmount so pages never stack multiple conflicting blocks.
export function useJsonLd(data) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);
}
