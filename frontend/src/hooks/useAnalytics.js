import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Query params and path segments that carry real secrets (password-reset
// tokens, email-verification tokens, invite tokens) or redirect targets
// that can themselves nest one of those — never send these to GA4/GTM.
const REDACTED_QUERY_PARAMS = ["token", "next"];

function sanitizePath(pathname, search) {
  const path = pathname.startsWith("/invite/") ? "/invite/[redacted]" : pathname;

  const params = new URLSearchParams(search);
  for (const key of REDACTED_QUERY_PARAMS) params.delete(key);
  const query = params.toString();

  return query ? `${path}?${query}` : path;
}

// GTM's built-in History Change trigger can miss/duplicate React Router
// navigations, so this pushes an explicit virtual-pageview event to
// dataLayer on every route change instead — including the first load.
// In GTM, build a Custom Event trigger matching event name "page_view"
// (not History Change) and attach the GA4 Configuration tag to it.
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    const path = sanitizePath(location.pathname, location.search);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_title: document.title,
      page_location: `${window.location.origin}${path}`,
      page_path: path,
    });
  }, [location.pathname, location.search]);
}
