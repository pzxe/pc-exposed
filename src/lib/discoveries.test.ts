import { describe, it, expect } from "vitest";
import { buildDiscoveries } from "./discoveries";
import { makeScan } from "@/engine/testFixtures";

describe("buildDiscoveries", () => {
  it("lists real findings in order, from the scan only", () => {
    const d = buildDiscoveries(makeScan({ startupEnabled: 4, startupDisabled: 2, rgb: ["OpenRGB"], gpu: "NVIDIA GeForce RTX 4070", vramGb: 12 }));
    const by = Object.fromEntries(d.map((x) => [x.id, x]));
    expect(by.cpu.text).toContain("16 threads");
    expect(by["gpu-NVIDIA GeForce RTX 4070"].text).toContain("12 GB VRAM");
    expect(by.ram.text).toMatch(/^32 GB/);
    expect(by.startup.text).toBe("4 apps start with Windows (2 disabled)");
    expect(by.apps.text).toContain("spotted 1 gaming/peripheral suite");
    expect(d.every((x) => x.status === "found")).toBe(true);
  });

  it("reports unavailable sections with their reason instead of dropping or zeroing them", () => {
    const d = buildDiscoveries(makeScan({ threads: null, ramGb: null, gpu: null }));
    const bad = d.filter((x) => x.status === "unavailable").map((x) => x.id);
    expect(bad).toEqual(expect.arrayContaining(["cpu", "ram", "gpu"]));
    expect(d.find((x) => x.id === "cpu")!.text).toBe("cpu failed");
  });

  it("ignores the software render adapter", () => {
    const s = makeScan();
    if (s.gpus.status === "available") s.gpus.value.push({ ...s.gpus.value[0], name: "Microsoft Basic Render Driver", isSoftware: true });
    expect(buildDiscoveries(s).filter((x) => x.label === "Graphics")).toHaveLength(1);
  });
});
