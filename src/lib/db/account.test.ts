import { describe, expect, it } from "vitest";
import { dbNameFor } from "./account";

describe("per-account device database", () => {
  it("lets the first account on a device keep the existing data", () => {
    expect(dbNameFor("a", "a")).toBe("homestudy");
    expect(dbNameFor(null, null)).toBe("homestudy");
    expect(dbNameFor("a", null)).toBe("homestudy");
  });

  it("gives other accounts on the same device their own database", () => {
    expect(dbNameFor("b", "a")).toBe("homestudy-b");
  });
});
