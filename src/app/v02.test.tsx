/**
 * v0.2 UI flows: scan history recording (with a mocked native scanner), Glow-Up Plan,
 * and the v0.2 bug fixes (Wrapped Space key, import input reset, version source).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { makeScan } from "@/engine/testFixtures";

let nextScan = { at: 1_800_000_000_000, startup: 20 };
vi.mock("@/lib/tauri", async (orig) => {
  const actual = await orig<typeof import("@/lib/tauri")>();
  return {
    ...actual,
    runScan: async () => ({ ...makeScan({ startupEnabled: nextScan.startup }), scannedAtMs: nextScan.at }),
  };
});

const { App } = await import("./App");
const { historyStore, HISTORY_KEY } = await import("@/reports/history");
const { reportStore } = await import("@/reports/store");
const { APP_VERSION } = await import("@/lib/version");

beforeEach(() => {
  localStorage.clear();
  historyStore.invalidate();
  reportStore.invalidate();
  nextScan = { at: 1_800_000_000_000, startup: 20 };
});

const scanNow = async () => {
  fireEvent.click(screen.getAllByRole("button", { name: /EXPOSE MY PC/ })[0]);
  await screen.findByRole("button", { name: /SEE MY RESULTS|Skip animation/ });
  fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
};

describe("scan history (opt-in)", () => {
  it("records nothing while history is off (the default)", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    await scanNow();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(screen.getByText("Track your PC over time")).toBeInTheDocument();
  });

  it("once turned on, records each real scan once and shows the change since the last one", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on history" }));
    await scanNow();
    expect(historyStore.list()).toHaveLength(1);

    nextScan = { at: 1_800_000_900_000, startup: 4 }; // fewer startup apps: score goes up
    await scanNow();
    await waitFor(() => expect(historyStore.list()).toHaveLength(2));
    expect(screen.getByTestId("home-delta").textContent).toMatch(/^Up \d+ since your scan on/);

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const list = within(screen.getByTestId("history-list"));
    expect(list.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(list.getByText("Startup apps -16")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete all history" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(historyStore.list()).toEqual([]);
  });

  it("never records the synthetic demo scan", async () => {
    localStorage.setItem("pc-exposed.settings.v1", JSON.stringify({ motion: "off", language: "en", keepHistory: true }));
    window.history.pushState({}, "", "/?demo=1");
    render(<App />);
    await screen.findByText("Your last scan");
    expect(historyStore.list()).toEqual([]);
  });

  it("after a restart (no scan in memory) the dashboard shows the last recorded scan", async () => {
    window.history.pushState({}, "", "/");
    localStorage.setItem("pc-exposed.settings.v1", JSON.stringify({ motion: "off", language: "en", keepHistory: true }));
    const first = render(<App />);
    await scanNow();
    first.unmount();
    render(<App />);
    expect(screen.getByText(/Last recorded scan/)).toBeInTheDocument();
  });
});

describe("Glow-Up Plan screen", () => {
  it("lists ranked actions with projected scores for the demo scan, and Results links to it", async () => {
    window.history.pushState({}, "", "/?demo=1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    fireEvent.click(await screen.findByTestId("plan-teaser"));
    expect(screen.getByRole("heading", { level: 1, name: "Glow-Up Plan" })).toBeInTheDocument();
    const actions = screen.getAllByTestId("plan-action");
    expect(actions.length).toBeGreaterThan(0);
    expect(within(actions[0]).getByText(/Trim startup apps to 5/)).toBeInTheDocument();
    expect(within(actions[0]).getByText(/Startup Efficiency 70 → 100/)).toBeInTheDocument();
  });
});

describe("v0.2 fixes", () => {
  it("Space on a focused Wrapped button does not also advance the slide", async () => {
    window.history.pushState({}, "", "/?demo=1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    fireEvent.click(await screen.findByRole("button", { name: /Open PC Wrapped/ }));
    const dlg = screen.getByRole("dialog", { name: "PC Wrapped" });
    const next = within(dlg).getByRole("button", { name: "Next slide" });
    fireEvent.keyDown(next, { key: " " }); // the browser then clicks the button: that alone must advance
    expect(within(dlg).getByText(/^1 \/ \d+$/)).toBeInTheDocument(); // not advanced by the key itself
    fireEvent.keyDown(dlg, { key: " " }); // Space elsewhere still advances
    expect(within(dlg).getByText(/^2 \/ \d+$/)).toBeInTheDocument();
  });

  it("a rejected import can be retried with the same file (the input is cleared)", async () => {
    window.history.pushState({}, "", "/?demo=1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Compare PCs" }));
    const input = screen.getByTestId("import-input") as HTMLInputElement;
    const f = new File(["{nope"], "r.json", { type: "application/json" });
    Object.defineProperty(f, "text", { value: async () => "{nope" });
    fireEvent.change(input, { target: { files: [f] } });
    await screen.findByText(/not valid JSON/);
    expect(input.value).toBe("");
  });

  it("saving the same scan twice keeps one report, dated by the scan time", async () => {
    window.history.pushState({}, "", "/?demo=1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Compare PCs" }));
    await screen.findByText(/Systems \(1\)/);
    fireEvent.click(screen.getByRole("button", { name: /Save current scan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save current scan/ }));
    expect(await screen.findByText(/already saved/)).toBeInTheDocument();
    expect(reportStore.list()).toHaveLength(1);
  });

  it("the app version comes from package.json at build time", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
