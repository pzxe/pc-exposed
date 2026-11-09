import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { App } from "./App";

// The dev-only demo mode loads a synthetic, loudly labelled scan so UI flows can be tested.
beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/?demo=1");
});

describe("results flow (demo data)", () => {
  it("labels demo data, shows the score and explains a category", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    expect(await screen.findByText(/DEMO DATA \(synthetic\)/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Score \d+ out of 100/ })).toBeInTheDocument();
    const row = screen.getByRole("button", { name: /Startup Efficiency/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/14 enabled startup entries/)).toBeInTheDocument();
  });

  it("analysis screen separates the four bottleneck kinds and shows the benchmark notice", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "System Analysis" }));
    expect(await screen.findByText(/did not run any benchmark/)).toBeInTheDocument();
    for (const k of ["Measured", "Potential", "Hardware pairing", "Insufficient evidence"]) {
      expect(screen.getByRole("region", { name: k })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("region", { name: "Insufficient evidence" })).getByText(/GPU load unknown/)).toBeInTheDocument();
  });

  it("roast screen re-rolls to a different set", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Roast" }));
    const first = (await screen.findByTestId("best-roast")).textContent;
    const seen = new Set<string>([first!]);
    for (let n = 0; n < 4; n++) {
      fireEvent.click(screen.getByRole("button", { name: /Roast me again/ }));
      seen.add(screen.getByTestId("best-roast").textContent!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("PC Wrapped opens, navigates with the keyboard and closes", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    fireEvent.click(await screen.findByRole("button", { name: /Open PC Wrapped/ }));
    const dlg = screen.getByRole("dialog", { name: "PC Wrapped" });
    expect(within(dlg).getByText("Your PC, exposed.")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dlg).getByText("YOUR PC SCORE")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(dlg).getByText("PC WRAPPED")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("personality screen lists all personalities and highlights the assigned one", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Personality" }));
    expect(await screen.findByText(/All 12 personalities/)).toBeInTheDocument();
    expect(document.querySelectorAll("li[aria-current='true']")).toHaveLength(1);
  });
});
