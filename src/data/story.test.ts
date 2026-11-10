import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/game/achievements";
import { CUTE_STORY, NOIR_STORY, isUnlocked, renderStory, storyKey, unreadCount } from "./story";

describe("story", () => {
  it("has matching entries in both themes with valid unlocks", () => {
    expect(NOIR_STORY.map((e) => storyKey(e.id))).toEqual(CUTE_STORY.map((e) => storyKey(e.id)));
    for (const list of [NOIR_STORY, CUTE_STORY]) {
      expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
      const levels = list.flatMap((e) => ("level" in e.unlock ? [e.unlock.level] : []));
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(new Set(levels).size).toBe(levels.length); // 한 레벨에 한 편
      for (const e of list) {
        if ("badge" in e.unlock) expect(BADGES.some((b) => b.id === (e.unlock as { badge: string }).badge), e.id).toBe(true);
        expect(e.body.length).toBeGreaterThan(0);
      }
    }
    NOIR_STORY.forEach((e, i) => expect(e.unlock).toEqual(CUTE_STORY[i].unlock));
  });

  it("unlocks by level or badge", () => {
    expect(isUnlocked(NOIR_STORY[0], 1, new Set())).toBe(false);
    expect(isUnlocked(NOIR_STORY[0], 2, new Set())).toBe(true);
    const side = NOIR_STORY.find((e) => e.id === "ns1")!;
    expect(isUnlocked(side, 99, new Set())).toBe(false);
    expect(isUnlocked(side, 1, new Set(["streak7"]))).toBe(true);
  });

  it("fills in the name with the right particle and species paragraph", () => {
    const second = NOIR_STORY.find((e) => e.id === "n2")!;
    expect(renderStory(second, "에코", "cloud")[0]).toBe("너는 나를 에코라 불렀다.");
    expect(renderStory(second, "민준", "cloud")[0]).toBe("너는 나를 민준이라 불렀다.");
    const first = NOIR_STORY[0];
    expect(renderStory(first, "에코", "flame").at(-1)).toContain("잿불");
    expect(renderStory(first, "에코", "sprout").at(-1)).toContain("덩굴");
    expect(renderStory(NOIR_STORY.at(11)!, "에코", "cloud").at(-1)).toContain("— 에코");
  });

  it("counts unread across themes with shared keys", () => {
    expect(unreadCount("noir", 4, new Set(), [])).toBe(3);
    expect(unreadCount("cute", 4, new Set(), ["1", "2"])).toBe(1);
    expect(unreadCount("noir", 1, new Set(["wrong10"]), [])).toBe(1);
  });
});
