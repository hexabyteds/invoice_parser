// Lightweight User-Agent parser for login_history — good enough to label
// the major browsers and device/OS families for a "recent logins" list
// without pulling in a full UA-parsing dependency. Not exhaustive by
// design; anything unrecognized falls back to "Unknown" rather than
// guessing wrong.
function parseUserAgent(uaString) {
  if (!uaString || typeof uaString !== "string") {
    return { browser: "Unknown", device: "Unknown" };
  }

  const ua = uaString;

  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
  else if (/CriOS\//.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS\//.test(ua)) browser = "Firefox (iOS)";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
  else if (/MSIE |Trident\//.test(ua)) browser = "Internet Explorer";

  let device = "Desktop";
  if (/iPad/.test(ua)) device = "iPad";
  else if (/iPhone/.test(ua)) device = "iPhone";
  else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? "Android Phone" : "Android Tablet";
  else if (/Windows NT/.test(ua)) device = "Windows PC";
  else if (/Macintosh|Mac OS X/.test(ua)) device = "Mac";
  else if (/Linux/.test(ua)) device = "Linux PC";

  return { browser, device };
}

module.exports = { parseUserAgent };
