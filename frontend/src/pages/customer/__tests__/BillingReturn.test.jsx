import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../services/subscriptionApi", () => ({
  default: {
    getCurrent: vi.fn(),
  },
}));

import subscriptionApi from "../../../services/subscriptionApi";
import BillingReturn from "../BillingReturn";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard/billing/return?session_id=cs_test_123"]}>
      <BillingReturn />
    </MemoryRouter>
  );
}

describe("BillingReturn", () => {
  beforeEach(() => {
    subscriptionApi.getCurrent.mockReset();
  });

  it("shows a loading state before the subscription has been (re)fetched", () => {
    subscriptionApi.getCurrent.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(
      screen.getByText(/confirming your subscription/i)
    ).toBeInTheDocument();
  });

  it("re-fetches the real subscription from the API rather than trusting the redirect/URL alone", async () => {
    subscriptionApi.getCurrent.mockResolvedValue({
      data: {
        success: true,
        subscription: { name: "Starter", stripe_status: "active" },
      },
    });

    renderPage();

    expect(await screen.findByText(/you're on starter/i)).toBeInTheDocument();

    // The success_url's session_id query param is never read directly —
    // the page always calls back into our own API for the real state.
    expect(subscriptionApi.getCurrent).toHaveBeenCalled();
  });

  it("shows an error state if the subscription can't be confirmed", async () => {
    subscriptionApi.getCurrent.mockRejectedValue({
      response: { data: { error: "Network error." } },
    });

    renderPage();

    expect(
      await screen.findByText(/couldn't confirm your subscription/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Network error.")).toBeInTheDocument();
  });
});
