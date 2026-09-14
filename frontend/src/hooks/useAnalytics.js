import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// GTM's built-in History Change trigger can miss/duplicate React Router
// navigations, so this pushes an explicit virtual-pageview event to
// dataLayer on every route change instead — including the first load.
// In GTM, build a Custom Event trigger matching event name "page_view"
// (not History Change) and attach the GA4 Configuration tag to it.
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search]);
}
