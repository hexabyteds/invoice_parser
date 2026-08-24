// Centralizes where the session (token + user) lives so "Remember me" can
// mean something: checked -> localStorage (survives closing the browser),
// unchecked -> sessionStorage (cleared when the tab/browser closes). Every
// reader checks both so it doesn't matter which one a given session used.
const TOKEN_KEY = "token";
const USER_KEY = "user";
const COMPANY_KEY = "currentCompanyId";

function readFrom(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export function getToken() {
  return readFrom(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = readFrom(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user, remember) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));

  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

// Refreshes the cached user (e.g. after GET /auth/me) in whichever storage
// the session actually lives in, instead of assuming localStorage — that
// would leak a "don't remember me" session into persistent storage.
export function updateStoredUser(user) {
  const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMPANY_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(COMPANY_KEY);
}

// Which company/workspace the UI is currently acting as — read by
// services/api.js's request interceptor and sent as X-Company-Id on every
// request. Naming one here is never itself authorization (the backend's
// companyContext middleware always re-verifies membership) — it only
// selects which of the caller's own memberships the request should use.
export function getCurrentCompanyId() {
  const raw = readFrom(COMPANY_KEY);
  return raw ? Number(raw) : null;
}

export function setCurrentCompanyId(companyId) {
  const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  store.setItem(COMPANY_KEY, String(companyId));
}
