import { describe, it, expect } from "vitest";
import { buildSpecSheet } from "./specSheet";
import { makeScan } from "@/engine/testFixtures";

describe("spec sheet", () => {
  it("summarizes the real scan as plain text", () => {
    const text = buildSpecSheet(makeScan({
      threads: 16, cores: 8, clockMhz: 4500, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32,
      drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 420, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 2000, freeGb: 1000, kind: "hdd" }],
    }));
    expect(text).toContain("CPU: Test CPU (8C/16T, 4.50 GHz)");
    expect(text).toContain("GPU: NVIDIA GeForce RTX 4080 (16 GB)");
    expect(text).toContain("RAM: 32 GB");
    expect(text).toContain("Storage: C: 1000 GB SSD (42% free), D: 2.0 TB HDD (50% free)");
    expect(text).toContain("OS: Windows 11 Pro 24H2 (build 26100.1)");
    expect(text).toContain("Form factor: desktop");
  });

  it("omits what was unavailable instead of guessing, and never includes app or process names", () => {
    const text = buildSpecSheet(makeScan({ threads: null, gpu: null, ramGb: null, drives: null, startupEnabled: ["Discord"], procs: ["chrome.exe"] }));
    expect(text).not.toMatch(/CPU:|GPU:|RAM:|Storage:/);
    expect(text).not.toMatch(/Discord|chrome/);
    expect(text).toContain("OS:");
  });
});
