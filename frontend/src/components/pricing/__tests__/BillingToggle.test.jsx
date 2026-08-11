import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BillingToggle from "../BillingToggle";

describe("BillingToggle", () => {
  it("calls setYearly(false) when Monthly is clicked", async () => {
    const setYearly = vi.fn();
    const user = userEvent.setup();

    render(<BillingToggle yearly setYearly={setYearly} />);

    await user.click(screen.getByRole("button", { name: /monthly/i }));

    expect(setYearly).toHaveBeenCalledWith(false);
  });

  it("calls setYearly(true) when Yearly is clicked", async () => {
    const setYearly = vi.fn();
    const user = userEvent.setup();

    render(<BillingToggle yearly={false} setYearly={setYearly} />);

    await user.click(screen.getByRole("button", { name: /yearly/i }));

    expect(setYearly).toHaveBeenCalledWith(true);
  });

  it("reflects the current interval in which label is visually active", () => {
    const { rerender } = render(
      <BillingToggle yearly={false} setYearly={() => {}} />
    );

    expect(screen.getByRole("button", { name: /monthly/i })).toHaveClass(
      "text-white"
    );
    expect(screen.getByRole("button", { name: /yearly/i })).not.toHaveClass(
      "text-white"
    );

    rerender(<BillingToggle yearly setYearly={() => {}} />);

    expect(screen.getByRole("button", { name: /monthly/i })).not.toHaveClass(
      "text-white"
    );
    expect(screen.getByRole("button", { name: /yearly/i })).toHaveClass(
      "text-white"
    );
  });
});
