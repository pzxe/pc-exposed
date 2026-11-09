import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { NAV } from "./nav";
import { en } from "@/i18n/en";
import { parseSettings, DEFAULT_SETTINGS } from "@/lib/settings";

beforeEach(() => localStorage.clear());

describe("application shell", () => {
  it("renders every required screen (the nine from the spec, plus Compare PCs) via navigation", () => {
    render(<App />);
    expect(NAV.map((n) => en[n.labelKey])).toEqual([
      "Dashboard", "Investigation", "PC Exposure", "Personality", "Hardware", "System Analysis", "PC Roast", "Share Studio", "Compare PCs", "Settings",
    ]);
    for (const item of NAV) {
      fireEvent.click(screen.getByRole("button", { name: en[item.labelKey] }));
      expect(screen.getByRole("button", { name: en[item.labelKey] })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    }
  });

  it("EXPOSE MY PC never fabricates scan data outside the desktop app", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "EXPOSE MY PC" }));
    expect(screen.getByRole("heading", { level: 1, name: "Investigation" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/needs the desktop app/i);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    expect(screen.getByText("No results yet")).toBeInTheDocument();
  });

  it("persists the animation preference locally", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Animations"), { target: { value: "off" } });
    expect(document.documentElement.dataset.motion).toBe("off");
    expect(JSON.parse(localStorage.getItem("pc-exposed.settings.v1")!).motion).toBe("off");
  });
});

describe("settings parsing", () => {
  it("falls back to defaults on corrupt or hostile input", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ motion: "<script>" }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
