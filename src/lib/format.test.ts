import { describe, it, expect } from "vitest";
import { formatBytes, formatUptime, show, reasonOf } from "./format";
import { valueOf, type Reading } from "./scanTypes";

describe("format", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(16 * 1024 ** 3)).toBe("16 GB");
    expect(formatBytes(1.5 * 1024 ** 4)).toBe("1.5 TB");
    expect(formatBytes(-1)).toBe("—");
  });
  it("formats uptime", () => {
    expect(formatUptime(90)).toBe("1m");
    expect(formatUptime(3 * 3600 + 120)).toBe("3h 2m");
    expect(formatUptime(2 * 86400 + 5 * 3600)).toBe("2d 5h");
  });
});

describe("readings", () => {
  const zero: Reading<number> = { status: "available", value: 0 };
  const gone: Reading<number> = { status: "unavailable", reason: "no sensor" };
  it("keeps zero distinct from unavailable", () => {
    expect(show(zero)).toBe("0");
    expect(show(gone)).toBe("Unavailable");
    expect(valueOf(zero)).toBe(0);
    expect(valueOf(gone)).toBeUndefined();
    expect(reasonOf(gone)).toBe("no sensor");
  });
});
