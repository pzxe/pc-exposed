import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { App } from "./App";
import { analyze } from "@/engine/analyze";
import { makeScan } from "@/engine/testFixtures";
import { buildReport, serializeReport } from "@/reports/format";
import { reportStore } from "@/reports/store";
import type { FullAnalysis } from "./state";

beforeEach(() => {
  localStorage.clear();
  reportStore.invalidate();
  window.history.pushState({}, "", "/?demo=1");
});

const friendJson = (label = "Friend PC") =>
  serializeReport(buildReport(analyze(makeScan({ threads: 8, gpu: "NVIDIA GeForce RTX 3060", ramGb: 16, startupEnabled: 20 }), { seed: 2 }) as FullAnalysis, { label }));

/** jsdom's File may lack .text(); supply it so the component's real code path runs. */
function fileOf(content: string, name = "report.json"): File {
  const f = new File([content], name, { type: "application/json" });
  Object.defineProperty(f, "text", { value: async () => content });
  return f;
}

const openCompare = async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Compare PCs" }));
  await screen.findByText(/Systems \(1\)/); // the current (demo) scan is offered, unsaved
};
const importText = async (text: string) => {
  fireEvent.change(screen.getByTestId("import-input"), { target: { files: [fileOf(text)] } });
};

describe("Compare PCs flow", () => {
  it("saves the current scan, imports a friend's report, and compares them", async () => {
    await openCompare();
    fireEvent.click(screen.getByRole("button", { name: /Save current scan/ }));
    expect(await screen.findByText(/Systems \(2\)/)).toBeInTheDocument();
    expect(reportStore.list()).toHaveLength(1);

    await importText(friendJson());
    expect(await screen.findByText(/Imported “Friend PC”/)).toBeInTheDocument();
    expect(reportStore.list().find((s) => s.report.label === "Friend PC")!.source).toBe("imported");

    fireEvent.click(screen.getByRole("button", { name: "Use Current scan as PC A" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Friend PC as PC B" }));
    const summary = await screen.findByTestId("compare-summary");
    expect(summary.textContent).toMatch(/Current scan leads \d+–\d+/);
    const table = within(screen.getByTestId("compare-table"));
    expect(table.getByRole("rowheader", { name: "GPU" })).toBeInTheDocument();
    expect(table.getAllByText(/✓/).length).toBeGreaterThan(3);
    expect(screen.getByTestId("compare-canvas")).toBeInTheDocument();
  });

  it("an import can never overwrite an existing report (always gets a fresh id)", async () => {
    await openCompare();
    const text = friendJson("Twin");
    await importText(text);
    await screen.findByText(/Imported “Twin”/);
    await importText(text);
    await waitFor(() => expect(reportStore.list().filter((s) => s.report.label === "Twin")).toHaveLength(2));
    const ids = reportStore.list().map((s) => s.report.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders hostile imported text as plain text and strips pollution attempts", async () => {
    await openCompare();
    const evil = friendJson("x").replace('"label": "x"', '"label": "<img src=x onerror=alert(1)>Pwned <script>bad()</script>"')
      .replace('"format"', '"__proto__": {"polluted": 1}, "format"');
    await importText(evil);
    await screen.findByText(/Imported/);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const label = reportStore.list()[0].report.label;
    expect(label).not.toMatch(/[<>]/);
    expect(screen.getByTestId("report-list").textContent).toContain("Pwned");
  });

  it("rejects invalid files with specific reasons and changes nothing", async () => {
    await openCompare();
    const bad = JSON.parse(friendJson());
    bad.system.cpu.threads = 99999;
    bad.scores.overall = 500;
    await importText(JSON.stringify(bad));
    const alert = await screen.findByRole("status");
    expect(alert.textContent).toMatch(/Import rejected/);
    expect(alert.textContent).toMatch(/system\.cpu\.threads/);
    expect(alert.textContent).toMatch(/scores\.overall/);
    expect(reportStore.list()).toHaveLength(0);

    await importText("{definitely not json");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/not valid JSON/));
    await importText(JSON.stringify({ hello: "world" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/not a PC EXPOSED report/));
    expect(reportStore.list()).toHaveLength(0);
  });

  it("deletes a single saved report", async () => {
    await openCompare();
    await importText(friendJson("Delete me"));
    await screen.findByText(/Imported “Delete me”/);
    fireEvent.click(screen.getByRole("button", { name: "Delete Delete me" }));
    await waitFor(() => expect(reportStore.list()).toHaveLength(0));
    expect(screen.queryByText("Delete me")).not.toBeInTheDocument();
  });
});

describe("Settings: local data", () => {
  it("deletes all saved reports after an explicit two-step confirmation", async () => {
    reportStore.save({ ...JSON.parse(friendJson("One")), id: "report-one" }, "local");
    reportStore.save({ ...JSON.parse(friendJson("Two")), id: "report-two" }, "local");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByTestId("report-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Delete saved reports" }));
    expect(reportStore.list()).toHaveLength(2); // nothing deleted until confirmed
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(reportStore.list()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Delete saved reports" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(reportStore.list()).toHaveLength(0);
    expect(screen.getByTestId("report-count")).toHaveTextContent("0");
    expect(screen.getByText(/All saved reports were deleted/)).toBeInTheDocument();
  });

  it("'Reset all local data' clears reports, roast history, studio prefs and settings", async () => {
    reportStore.save({ ...JSON.parse(friendJson("One")), id: "report-one" }, "local");
    localStorage.setItem("pc-exposed.studio.v1", JSON.stringify({ username: "me", privacy: true, watermark: false }));
    localStorage.setItem("pc-exposed.roasts.v1", JSON.stringify(["hw-gpu5-tabs"]));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Animations"), { target: { value: "off" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset all local data" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(reportStore.list()).toHaveLength(0));
    // State resets and effects re-save defaults, but the user's data must be gone.
    expect(localStorage.getItem("pc-exposed.studio.v1")).toBeNull();
    expect(JSON.parse(localStorage.getItem("pc-exposed.roasts.v1") ?? "[]")).toEqual([]);
    expect((screen.getByLabelText("Animations") as HTMLSelectElement).value).toBe("system");
  });
});

describe("roast history persistence", () => {
  it("remembers shown roasts across sessions and ignores tampered storage", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Roast" }));
    await screen.findByTestId("best-roast");
    fireEvent.click(screen.getByRole("button", { name: /Roast me again/ }));
    const saved = JSON.parse(localStorage.getItem("pc-exposed.roasts.v1")!) as string[];
    expect(saved.length).toBeGreaterThanOrEqual(3);
    expect(saved.every((id) => /^[a-z0-9-]{1,40}$/.test(id))).toBe(true);
  });

  it("loads only well-formed ids from storage", async () => {
    localStorage.setItem("pc-exposed.roasts.v1", JSON.stringify(["ok-id", "<script>", 42, "x".repeat(100), "also-ok"]));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Roast" }));
    await screen.findByTestId("best-roast");
    fireEvent.click(screen.getByRole("button", { name: /Roast me again/ }));
    const saved = JSON.parse(localStorage.getItem("pc-exposed.roasts.v1")!) as string[];
    expect(saved).toEqual(expect.arrayContaining(["ok-id", "also-ok"]));
    expect(saved).not.toContain("<script>");
    expect(saved.every((x) => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x))).toBe(true);
  });
});
