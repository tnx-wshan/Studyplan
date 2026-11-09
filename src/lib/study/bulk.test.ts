import { describe, expect, it } from "vitest";
import { parseBulk } from "./bulk";

describe("parseBulk", () => {
  it("splits on common separators and skips bad lines", () => {
    expect(parseBulk("abundant - 풍부한\nwell-known=잘 알려진\n임진왜란 : 1592년\n\n잘못된 줄\nH2O\t물")).toEqual([
      { front: "abundant", back: "풍부한" },
      { front: "well-known", back: "잘 알려진" },
      { front: "임진왜란", back: "1592년" },
      { front: "H2O", back: "물" },
    ]);
  });
});
