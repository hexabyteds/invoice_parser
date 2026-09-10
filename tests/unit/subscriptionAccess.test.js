const { canWrite, getTrialInfo, blockedReasonCode, isTrialExpired } = require("../../utils/subscriptionAccess");

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

describe("subscriptionAccess", () => {
  describe("canWrite", () => {
    it("allows an active subscription regardless of expires_at", () => {
      expect(canWrite({ status: "active", expires_at: null })).toBe(true);
      expect(canWrite({ status: "active", expires_at: hoursFromNow(-100) })).toBe(true);
    });

    it("allows a trialing subscription before expires_at", () => {
      expect(canWrite({ status: "trial", expires_at: hoursFromNow(1) })).toBe(true);
    });

    it("blocks a trialing subscription once expires_at has passed", () => {
      expect(canWrite({ status: "trial", expires_at: hoursFromNow(-1) })).toBe(false);
    });

    it("blocks expired/suspended/cancelled subscriptions", () => {
      expect(canWrite({ status: "expired", expires_at: null })).toBe(false);
      expect(canWrite({ status: "suspended", expires_at: null })).toBe(false);
      expect(canWrite({ status: "cancelled", expires_at: null })).toBe(false);
    });

    it("blocks a missing subscription entirely", () => {
      expect(canWrite(null)).toBe(false);
      expect(canWrite(undefined)).toBe(false);
    });
  });

  describe("blockedReasonCode", () => {
    it("is TRIAL_EXPIRED for an expired trial", () => {
      expect(blockedReasonCode({ status: "trial", expires_at: hoursFromNow(-1) })).toBe("TRIAL_EXPIRED");
    });

    it("is SUBSCRIPTION_INACTIVE for every other non-writable state", () => {
      expect(blockedReasonCode({ status: "expired" })).toBe("SUBSCRIPTION_INACTIVE");
      expect(blockedReasonCode({ status: "suspended" })).toBe("SUBSCRIPTION_INACTIVE");
      expect(blockedReasonCode({ status: "cancelled" })).toBe("SUBSCRIPTION_INACTIVE");
    });
  });

  describe("getTrialInfo", () => {
    it("reports not-trialing for an active subscription", () => {
      expect(getTrialInfo({ status: "active" })).toEqual({
        isTrialing: false,
        trialEndsAt: null,
        daysRemaining: null,
        isExpired: false,
      });
    });

    it("reports days remaining while trialing", () => {
      const info = getTrialInfo({ status: "trial", expires_at: hoursFromNow(48) });
      expect(info.isTrialing).toBe(true);
      expect(info.isExpired).toBe(false);
      expect(info.daysRemaining).toBe(2);
    });

    it("reports zero days remaining and isExpired once the trial has passed", () => {
      const info = getTrialInfo({ status: "trial", expires_at: hoursFromNow(-48) });
      expect(info).toEqual({
        isTrialing: true,
        trialEndsAt: expect.any(Date),
        daysRemaining: 0,
        isExpired: true,
      });
    });
  });

  describe("isTrialExpired", () => {
    it("is false for any non-trial status", () => {
      expect(isTrialExpired({ status: "active", expires_at: hoursFromNow(-100) })).toBe(false);
      expect(isTrialExpired({ status: "expired", expires_at: hoursFromNow(-100) })).toBe(false);
    });

    it("is false for a trial with no expires_at set", () => {
      expect(isTrialExpired({ status: "trial", expires_at: null })).toBe(false);
    });
  });
});
