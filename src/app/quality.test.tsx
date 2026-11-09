import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { App } from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RadioGroup } from "@/components/RadioGroup";
import { en } from "@/i18n/en";
import { registerLocale, unregisterLocale, translate, translatePlural, makeI18n, listLocales, isLocaleId, type Messages } from "@/i18n";
import { contrastRatio } from "@/lib/contrast";
import { checkForUpdates, compareVersions, DEFAULT_UPDATE_PROVIDER } from "@/lib/updates";
import { COLLECTED_SECTIONS, collectedKey, NEVER_COLLECTED } from "@/lib/privacyInfo";
import { makeScan } from "@/engine/testFixtures";
import { parseSettings } from "@/lib/settings";
import { reportStore } from "@/reports/store";
import { useState } from "react";

const SRC = resolve(__dirname, "..");
const sourceFiles = (): string[] => {
  const out: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((n) => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.|testFixtures/.test(n)) out.push(p);
  });
  walk(SRC);
  return out;
};

beforeEach(() => { localStorage.clear(); reportStore.invalidate(); window.history.pushState({}, "", "/?demo=1"); });

describe("localization architecture", () => {
  const ar: Messages = {
    ...(en as unknown as Messages),
    "nav.home": "لوحة التحكم",
    "settings.title": "الإعدادات",
    "settings.local.count.zero": "لا توجد تقارير محفوظة",
    "settings.local.count.one": "لديك تقرير واحد محفوظ",
    "settings.local.count.two": "لديك تقريران محفوظان",
    "settings.local.count.few": "لديك {count} تقارير محفوظة",
    "settings.local.count.many": "لديك {count} تقريرا محفوظا",
    "settings.local.count.other": "لديك {count} تقرير محفوظ",
  };
  beforeEach(() => registerLocale({ id: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", messages: ar }));
  afterEach(() => unregisterLocale("ar"));

  it("translates with interpolation, falls back to English, then to the key", () => {
    expect(translate("en", "home.last.score", { score: 90, verdict: "Elite" })).toBe("Score 90/100 · Elite");
    expect(translate("ar", "nav.home")).toBe("لوحة التحكم");
    const partial: Messages = { ...(en as unknown as Messages) };
    delete (partial as Record<string, string>)["home.title"];
    registerLocale({ id: "xx", name: "X", nativeName: "X", dir: "ltr", messages: partial });
    expect(translate("xx", "home.title")).toBe(en["home.title"]); // English fallback
    expect(translate("en", "does.not.exist")).toBe("does.not.exist"); // visible, never blank
    unregisterLocale("xx");
  });

  it("uses CLDR plural rules, including Arabic's six forms", () => {
    expect(translatePlural("en", "settings.local.count", 1)).toBe("You have 1 saved report.");
    expect(translatePlural("en", "settings.local.count", 3)).toBe("You have 3 saved reports.");
    expect(translatePlural("ar", "settings.local.count", 0)).toBe("لا توجد تقارير محفوظة");
    expect(translatePlural("ar", "settings.local.count", 1)).toBe("لديك تقرير واحد محفوظ");
    expect(translatePlural("ar", "settings.local.count", 2)).toBe("لديك تقريران محفوظان");
    expect(translatePlural("ar", "settings.local.count", 5)).toBe("لديك 5 تقارير محفوظة");
    expect(translatePlural("ar", "settings.local.count", 11)).toBe("لديك 11 تقريرا محفوظا");
    expect(translatePlural("ar", "settings.local.count", 100)).toBe("لديك 100 تقرير محفوظ");
  });

  it("formats numbers and dates for the locale", () => {
    expect(makeI18n("en").formatNumber(1234567)).toBe("1,234,567");
    expect(makeI18n("ar").formatNumber(5)).not.toBe(""); // Intl handles script-specific digits
    expect(makeI18n("ar").dir).toBe("rtl");
  });

  it("switching to an RTL locale updates <html lang dir> and translated chrome", () => {
    localStorage.setItem("pc-exposed.settings.v1", JSON.stringify({ motion: "off", language: "ar" }));
    render(<App />);
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "لوحة التحكم" })).toBeInTheDocument();
  });

  it("the language picker lists registered locales and applies the choice", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const select = screen.getByLabelText("Language") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["en", "ar"]);
    fireEvent.change(select, { target: { value: "ar" } });
    expect(document.documentElement.dir).toBe("rtl");
    fireEvent.change(select, { target: { value: "en" } });
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("rejects unknown languages from storage", () => {
    expect(parseSettings(JSON.stringify({ language: "zz" })).language).toBe("en");
    expect(isLocaleId("en")).toBe(true);
    expect(listLocales().map((l) => l.id)).toContain("en");
  });

  it("every catalog key used in code exists in the English catalog", () => {
    const keys = new Set(Object.keys(en));
    const missing: string[] = [];
    let used = 0;
    for (const f of sourceFiles()) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/["'`]((?:nav|shell|window|common|needsScan|home|settings|privacy|error)\.[A-Za-z0-9.]+)["'`]/g)) {
        const k = m[1];
        used++;
        const ok = keys.has(k) || keys.has(`${k}.other`) || /^privacy\.collect\.$/.test(k) || k.endsWith(".");
        if (!ok) missing.push(`${k} (${f.replace(SRC, "")})`);
      }
    }
    expect(used).toBeGreaterThan(40); // the scan must actually find the usages, or this test proves nothing
    expect(missing).toEqual([]);
  });

  it("UI never uses physical left/right Tailwind utilities (RTL-safe)", () => {
    const bad = /\b(ml|mr|pl|pr)-\d|\btext-(left|right)\b|\bborder-[lr]\b|\brounded-[lr]-|\b(left|right)-\d/;
    expect(bad.test('className="ml-2 text-left"')).toBe(true); // detector sanity
    expect(bad.test('className="ms-2 text-start"')).toBe(false);
    const offenders = sourceFiles().filter((f) => f.endsWith(".tsx") && bad.test(readFileSync(f, "utf8"))).map((f) => f.replace(SRC, ""));
    expect(offenders).toEqual([]);
  });
});

describe("scrollable regions are keyboard accessible (static guard)", () => {
  it("every overflow-auto element also declares tabIndex", () => {
    const re = /overflow-(?:y-|x-)?auto/;
    expect(re.test('className="max-h-40 overflow-y-auto"')).toBe(true); // detector sanity
    const offenders: string[] = [];
    for (const f of sourceFiles().filter((x) => x.endsWith(".tsx"))) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (re.test(line) && !line.includes("tabIndex")) offenders.push(`${f.replace(SRC, "")}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("accessible color contrast (WCAG 2.1 AA, from the real design tokens)", () => {
  const css = readFileSync(join(SRC, "styles/index.css"), "utf8");
  const color = (name: string) => {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
    if (!m) throw new Error(`token ${name} not found`);
    return m[1];
  };

  const pairs: [string, string, number][] = [
    ["ink", "bg", 4.5], ["ink", "surface", 4.5], ["ink", "surface-2", 4.5],
    ["muted", "bg", 4.5], ["muted", "surface", 4.5], ["muted", "surface-2", 4.5],
    ["accent", "bg", 4.5], ["accent", "surface", 4.5], ["accent-soft", "bg", 4.5], ["accent-soft", "surface", 4.5],
    ["bg", "accent", 4.5], // primary button label
    ["good", "surface", 4.5], ["bad", "surface", 4.5], ["warn", "surface", 4.5], ["good", "bg", 4.5], ["bad", "bg", 4.5], ["warn", "bg", 4.5],
  ];
  it.each(pairs)("%s on %s ≥ %s:1", (fg, bg, min) => {
    expect(contrastRatio(color(fg), color(bg))).toBeGreaterThanOrEqual(min);
  });

  it("matches the specified brand palette", () => {
    expect(color("bg").toLowerCase()).toBe("#111014");
    expect(color("surface").toLowerCase()).toBe("#211b2b");
    expect(color("accent").toLowerCase()).toBe("#a879ff");
    expect(color("accent-soft").toLowerCase()).toBe("#f1ddfe");
    expect(color("muted").toLowerCase()).toBe("#a89bb5");
  });

  it("contrast function is correct on known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("update-check architecture", () => {
  it("orders semantic versions including pre-releases", () => {
    expect(compareVersions("0.1.0-beta.1", "0.1.0-beta.2")).toBeLessThan(0);
    expect(compareVersions("0.1.0-beta.2", "0.1.0-beta.10")).toBeLessThan(0);
    expect(compareVersions("0.1.0-beta.9", "0.1.0")).toBeLessThan(0);
    expect(compareVersions("0.1.0", "0.1.0-rc.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v0.2.0", "0.2.0+build5")).toBe(0);
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBeLessThan(0);
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBeLessThan(0);
    expect(() => compareVersions("banana", "1.0.0")).toThrow();
  });

  it("does nothing without a provider (the app never contacts a server by default)", async () => {
    expect(DEFAULT_UPDATE_PROVIDER).toBeNull();
    expect(await checkForUpdates("0.1.0-beta.1", DEFAULT_UPDATE_PROVIDER)).toEqual({ status: "disabled" });
  });

  it("reports available, up-to-date and error states from a provider", async () => {
    const p = (v: string | null) => ({ id: "t", latest: async () => (v ? { version: v } : null) });
    expect((await checkForUpdates("0.1.0", p("0.2.0"))).status).toBe("available");
    expect((await checkForUpdates("0.2.0", p("0.2.0"))).status).toBe("up-to-date");
    expect((await checkForUpdates("0.2.0", p("0.1.9"))).status).toBe("up-to-date");
    expect((await checkForUpdates("0.2.0", p(null))).status).toBe("up-to-date");
    const bad = await checkForUpdates("0.2.0", { id: "t", latest: async () => { throw new Error("offline"); } });
    expect(bad).toEqual({ status: "error", message: "offline" });
  });

  it("Settings explains that updates are never automatic", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText(/never contacts a server on its own/)).toBeInTheDocument();
  });
});

describe("privacy disclosure", () => {
  it("discloses every section the scanner can read (cannot fall behind the scan model)", () => {
    const scan = makeScan();
    const meta = new Set(["schemaVersion", "appVersion", "scannedAtMs", "scanDurationMs", "issues"]);
    const sections = Object.keys(scan).filter((k) => !meta.has(k)).sort();
    expect([...COLLECTED_SECTIONS].sort()).toEqual(sections);
    for (const id of COLLECTED_SECTIONS) expect(en[collectedKey(id)].length).toBeGreaterThan(20);
  });

  it("Settings shows what is read and what is never read", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const read = within(screen.getByTestId("collected-list"));
    expect(read.getByText(/Never file or folder contents/)).toBeInTheDocument();
    expect(read.getByText(/Never MAC or IP addresses/)).toBeInTheDocument();
    expect(within(screen.getByTestId("never-list")).getAllByRole("listitem")).toHaveLength(NEVER_COLLECTED.length);
    expect(screen.getByText(/Browser history, cookies, saved passwords/)).toBeInTheDocument();
  });
});

describe("no network, no telemetry (static guard)", () => {
  it("app code contains no network-request APIs, analytics SDKs or remote URLs", () => {
    const bad = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|EventSource|navigator\.connection|importScripts|\.src\s*=\s*["'`]https?:|google-analytics|gtag\(|segment\.|mixpanel|sentry|posthog|amplitude/i;
    for (const sample of ["await fetch('/x')", "new XMLHttpRequest()", "new WebSocket(u)", "navigator.sendBeacon(u)", "import mixpanel", "Sentry.init", "gtag('x')"]) {
      expect(bad.test(sample), `detector misses: ${sample}`).toBe(true);
    }
    expect(bad.test("const fetchedAt = 1; // refetch later")).toBe(false);
    const offenders = sourceFiles().filter((f) => bad.test(readFileSync(f, "utf8"))).map((f) => f.replace(SRC, ""));
    expect(offenders).toEqual([]);
  });

  it("the only absolute URLs in app code are inert (docs/comments/SVG namespace)", () => {
    const urls: string[] = [];
    for (const f of sourceFiles()) {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/https?:\/\/[^\s"'`)]+/g);
        if (m && !/^\s*(\/\/|\*|\/\*)/.test(line)) urls.push(...m.map((u) => `${u} in ${f.replace(SRC, "")}`));
      }
    }
    expect(urls.filter((u) => !/schema\.tauri\.app|w3\.org|ipc\.localhost|127\.0\.0\.1/.test(u))).toEqual([]);
  });
});

describe("keyboard and focus behaviour", () => {
  it("has a skip link and a keyboard-reachable main region", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("tabindex", "0");
    expect(main).toHaveAccessibleName("Content");
  });

  it("moves focus to the new screen's heading on navigation and updates the window title", async () => {
    render(<App />);
    expect(document.title).toBe("Dashboard · PC EXPOSED");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(document.title).toBe("Settings · PC EXPOSED");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Settings" }));
  });

  it("RadioGroup: one tab stop, arrows move and select, Home/End jump, RTL mirrors arrows", () => {
    function Demo() {
      const [v, setV] = useState<"a" | "b" | "c">("a");
      return <RadioGroup label="Pick" value={v} onChange={setV} options={(["a", "b", "c"] as const).map((x) => ({ value: x, content: x }))} />;
    }
    render(<Demo />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "b" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("radio", { name: "c" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" }); // wraps
    expect(screen.getByRole("radio", { name: "a" })).toHaveAttribute("aria-checked", "true");
    document.documentElement.dir = "rtl";
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" }); // "next" in RTL
    expect(screen.getByRole("radio", { name: "b" })).toHaveAttribute("aria-checked", "true");
    document.documentElement.dir = "ltr";
  });

  it("PC Wrapped traps Tab inside the dialog and returns focus to the opener on close", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "PC Exposure" }));
    const opener = await screen.findByRole("button", { name: /Open PC Wrapped/ });
    opener.focus();
    fireEvent.click(opener);
    const dlg = screen.getByRole("dialog", { name: "PC Wrapped" });
    const buttons = () => within(dlg).getAllByRole("button").filter((b) => !(b as HTMLButtonElement).disabled);
    const first = buttons()[0], last = buttons()[buttons().length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first); // wraps forward
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last); // wraps backward
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });
});

describe("error boundary", () => {
  it("shows a calm message and reload button instead of a blank window", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = () => { throw new Error("kaboom"); };
    render(<ErrorBoundary locale="en"><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert")).toHaveTextContent("Your saved reports are safe");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("home dashboard", () => {
  it("summarizes the last scan from real analysis and links onward", async () => {
    render(<App />);
    expect(await screen.findByText("Your last scan")).toBeInTheDocument();
    expect(screen.getByText(/Score \d+\/100 ·/)).toBeInTheDocument();
    expect(screen.getByText(/DEMO DATA \(synthetic\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.getByRole("heading", { level: 1, name: "PC Exposure" })).toBeInTheDocument();
  });
});
