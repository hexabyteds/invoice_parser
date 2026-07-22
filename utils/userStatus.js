const DB_ACTIVE = "ACTIVE";
const DB_INACTIVE = "INACTIVE";

function toDbStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "active") {
    return DB_ACTIVE;
  }

  if (
    normalized === "suspended" ||
    normalized === "inactive" ||
    normalized === "deleted"
  ) {
    return DB_INACTIVE;
  }

  return DB_ACTIVE;
}

function fromDbStatus(status, deletedAt = null) {
  if (deletedAt) {
    return "deleted";
  }

  const normalized = String(status || "").toUpperCase();

  if (normalized === DB_ACTIVE) {
    return "active";
  }

  if (normalized === DB_INACTIVE) {
    return "suspended";
  }

  return "active";
}

function isAccountActive(status, deletedAt = null) {
  if (deletedAt) {
    return false;
  }

  return String(status || "").toUpperCase() === DB_ACTIVE;
}

module.exports = {
  DB_ACTIVE,
  DB_INACTIVE,
  toDbStatus,
  fromDbStatus,
  isAccountActive,
};
