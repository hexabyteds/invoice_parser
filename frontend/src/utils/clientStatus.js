export function isPartyActive(status) {
  return status !== "INACTIVE";
}

export function partyStatusLabel(status) {
  return status === "INACTIVE" ? "Inactive" : "Active";
}

export function partyStatusBadgeClass(status) {
  return status === "INACTIVE"
    ? "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
}
