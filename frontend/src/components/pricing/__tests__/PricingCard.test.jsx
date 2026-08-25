import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const navigateMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../../services/subscriptionApi", () => ({
  default: {
    selectPlan: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
  },
}));

import subscriptionApi from "../../../services/subscriptionApi";
import PricingCard from "../PricingCard";

const starterPlan = {
  id: 2,
  slug: "starter",
  name: "Starter",
  monthly_price: "19.00",
  yearly_price: "190.00",
  invoice_limit: 100,
  customer_limit: 25,
  user_limit: 1,
  storage_limit: 500,
  ocr_limit: 100,
};

const freePlan = {
  id: 1,
  slug: "free",
  name: "Free",
  monthly_price: "0.00",
  yearly_price: "0.00",
  invoice_limit: 5,
  customer_limit: 2,
  user_limit: 1,
  storage_limit: 50,
  ocr_limit: 5,
};

describe("PricingCard", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    subscriptionApi.selectPlan.mockReset();
    subscriptionApi.createCheckoutSession.mockReset();
  });

  it("redirects an unauthenticated visitor to /login instead of starting checkout", async () => {
    useAuthMock.mockReturnValue({ user: null });
    const user = userEvent.setup();

    render(<PricingCard plan={starterPlan} yearly={false} />);

    await user.click(screen.getByRole("button", { name: /start starter/i }));

    expect(navigateMock).toHaveBeenCalledWith("/login");
    expect(subscriptionApi.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("starts a monthly Stripe checkout for a logged-in user and redirects to the returned URL", async () => {
    useAuthMock.mockReturnValue({ user: { id: 1, name: "Test User" } });
    subscriptionApi.createCheckoutSession.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/session_test" },
    });

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    const user = userEvent.setup();
    render(<PricingCard plan={starterPlan} yearly={false} />);

    await user.click(screen.getByRole("button", { name: /start starter/i }));

    await waitFor(() =>
      expect(subscriptionApi.createCheckoutSession).toHaveBeenCalledWith(
        starterPlan.id,
        "monthly"
      )
    );
    await waitFor(() =>
      expect(window.location.href).toBe(
        "https://checkout.stripe.com/session_test"
      )
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("uses the yearly interval when the yearly toggle is active", async () => {
    useAuthMock.mockReturnValue({ user: { id: 1, name: "Test User" } });
    subscriptionApi.createCheckoutSession.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/session_yearly" },
    });

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    const user = userEvent.setup();
    render(<PricingCard plan={starterPlan} yearly />);

    await user.click(screen.getByRole("button", { name: /start starter/i }));

    await waitFor(() =>
      expect(subscriptionApi.createCheckoutSession).toHaveBeenCalledWith(
        starterPlan.id,
        "yearly"
      )
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("uses select-plan (not checkout) for the Free plan", async () => {
    useAuthMock.mockReturnValue({ user: { id: 1, name: "Test User" } });
    subscriptionApi.selectPlan.mockResolvedValue({ data: { success: true } });

    const user = userEvent.setup();
    render(<PricingCard plan={freePlan} yearly={false} />);

    await user.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() =>
      expect(subscriptionApi.selectPlan).toHaveBeenCalledWith(
        freePlan.id,
        "monthly"
      )
    );
    expect(subscriptionApi.createCheckoutSession).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/usage")
    );
  });

  it("shows the checkout error instead of silently failing", async () => {
    useAuthMock.mockReturnValue({ user: { id: 1, name: "Test User" } });
    subscriptionApi.createCheckoutSession.mockRejectedValue({
      response: { data: { error: "This plan is not available." } },
    });

    const user = userEvent.setup();
    render(<PricingCard plan={starterPlan} yearly={false} />);

    await user.click(screen.getByRole("button", { name: /start starter/i }));

    expect(
      await screen.findByText("This plan is not available.")
    ).toBeInTheDocument();
  });
});
