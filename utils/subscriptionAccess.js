// Pure, DB-free trial/subscription access logic — the single source of
// truth for "is this subscription allowed to write" and "what should the
// UI show about its trial", shared by middleware/requireActiveSubscription.js
// and every place that renders trial status (register/me responses,
// GET /api/subscriptions/current). No cron/sweep job keeps `status` in
// sync with `expires_at` — expiry is computed at read time instead, same
// pattern already used for company_invitations expiry.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isTrialExpired(subscription) {
  if (!subscription || subscription.status !== "trial") return false;
  if (!subscription.expires_at) return false;
  return new Date() > new Date(subscription.expires_at);
}

// True if this subscription currently permits create/edit/delete/upload
// operations. 'active' always can. 'trial' can until expires_at passes.
// Everything else ('expired', 'suspended', 'cancelled', or an expired
// trial) is read-only.
function canWrite(subscription) {
  if (!subscription) return false;

  if (subscription.status === "active") return true;

  if (subscription.status === "trial") {
    return !isTrialExpired(subscription);
  }

  return false;
}

// Machine-readable reason a blocked write was blocked, for the 403's
// `code` field — TRIAL_EXPIRED specifically for an expired trial (the
// case the frontend shows a dedicated "trial ended" message for),
// SUBSCRIPTION_INACTIVE for every other non-writable state.
function blockedReasonCode(subscription) {
  if (isTrialExpired(subscription)) return "TRIAL_EXPIRED";
  return "SUBSCRIPTION_INACTIVE";
}

// Trial summary for API responses (register, /auth/me, subscription
// detail) — everything the frontend needs to render a countdown/banner
// without doing its own date math against a raw expires_at.
function getTrialInfo(subscription) {
  const isTrialing = Boolean(subscription && subscription.status === "trial");

  if (!isTrialing) {
    return {
      isTrialing: false,
      trialEndsAt: null,
      daysRemaining: null,
      isExpired: false,
    };
  }

  const expired = isTrialExpired(subscription);

  // MySQL's DATETIME columns store whole seconds only and round (not
  // truncate) sub-second values on write — e.g. an expires_at computed at
  // :17.667 comes back from the DB as :18.000. That alone can push the
  // raw ms difference a few hundred ms past an exact 24h multiple, which
  // Math.ceil would then read as one whole extra day (7 days, 0.3s
  // remaining -> "8 days remaining"). Rounding to the nearest second
  // first — the DB's actual precision — absorbs that noise without
  // affecting any real multi-day countdown.
  const msRemaining = expired
    ? 0
    : Math.round((new Date(subscription.expires_at).getTime() - Date.now()) / 1000) * 1000;

  return {
    isTrialing: true,
    trialEndsAt: subscription.expires_at,
    daysRemaining: expired ? 0 : Math.ceil(msRemaining / MS_PER_DAY),
    isExpired: expired,
  };
}

module.exports = { canWrite, getTrialInfo, blockedReasonCode, isTrialExpired };
