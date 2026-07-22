export function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAdmin(user) {
  if (!user) return false;

  if (user.role === "admin" || user.role === "owner") {
    return true;
  }

  const allowlist = import.meta.env.VITE_ADMIN_EMAILS;

  if (allowlist && user.email) {
    const emails = allowlist.split(",").map((email) => email.trim().toLowerCase());
    return emails.includes(user.email.toLowerCase());
  }

  return false;
}

export function getPostLoginPath(user) {
  return isAdmin(user) ? "/admin" : "/dashboard";
}
