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

// Sets per-route <title>, meta description, canonical, and OG/Twitter tags.
// No react-helmet-async in this project — this is a small, dependency-free
// stand-in scoped to what the marketing pages actually need. If routes start
// needing SSR or a lot more head management, that's the point to reach for
// a real library instead of growing this further.
export function useSeo({ title, description, path }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | EazeeBooks` : "EazeeBooks";
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;

    upsertMeta("name", "description", description);
    upsertCanonical(url);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "EazeeBooks");

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
  }, [title, description, path]);
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
