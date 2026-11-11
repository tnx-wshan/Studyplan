import "server-only";
import { flattenImport } from "@/lib/learn/import";
import { questionCount, sanitizeSteps } from "@/lib/learn/check";
import type { UnitStatus } from "@/lib/learn/types";
import { transaction } from "./db";
import { courseOutline, createSection, createUnit } from "./learn";
import { figureMarkdown } from "./media";
import { sanitizeSvg, svgProblem } from "./svg";

/** 일괄 넣기 결과 한 줄 (유닛 하나) */
export interface ImportRow {
  where: string;
  grade: string;
  subject: string;
  section: string;
  title: string;
  /** ok: 넣을 수 있음(넣었음), duplicate: 같은 섹션에 같은 이름이 있어 건너뜀, error: 문제가 있어 건너뜀 */
  status: "ok" | "duplicate" | "error";
  problems: string[];
  steps: number;
  questions: number;
  figures: number;
  /** 섹션이 없어서 새로 만드는지(만들었는지) */
  newSection: boolean;
  unitId?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  problems: string[];
  /** 실제로 넣었는지 (검사만 했으면 false) */
  applied: boolean;
  added: number;
  sectionsAdded: number;
}

/**
 * 단계에 붙은 그림(figure: SVG)을 저장해서 정리(body)나 문제(prompt) 끝에 붙인다.
 * 검사만 할 때는 저장하지 않고 쓸 수 있는 그림인지만 본다.
 */
function attachFigures(steps: unknown[], save: boolean): { steps: unknown[]; figures: number; problems: string[] } {
  let figures = 0;
  const problems: string[] = [];
  const out = steps.map((raw, i) => {
    const s = { ...((raw ?? {}) as Record<string, unknown>) };
    const svg = typeof s.figure === "string" ? s.figure.trim() : "";
    delete s.figure;
    if (!svg) return s;
    if (!sanitizeSvg(svg)) {
      // 그림을 빼고 넣으면 "그림에서 …" 문제가 그림 없이 들어가므로 유닛 전체를 건너뛴다
      const why = svgProblem(svg.replace(/^```(?:svg|xml)?\s*|```$/g, "").trim()) ?? "너무 크거나 쓸 수 없는 내용이 있어요.";
      problems.push(`${i + 1}번째 단계의 그림(SVG)을 쓸 수 없어요: ${why}`);
      return s;
    }
    figures++;
    if (!save) return s;
    const md = figureMarkdown(svg, s.type === "summary" ? String(s.title || "정리 그림") : "문제 그림");
    const key = s.type === "summary" ? "body" : "prompt";
    if (md) s[key] = `${String(s[key] ?? "").trim()}\n\n${md}`;
    return s;
  });
  return { steps: out, figures, problems };
}

/**
 * 학습 유닛을 한꺼번에 넣는다. apply가 false면 검사 결과만 돌려준다.
 * - 섹션은 이름으로 찾고, 없으면 만든다(코스의 끝에 붙는다).
 * - 문제가 있는 유닛과 같은 섹션에 같은 이름이 이미 있는 유닛은 건너뛴다. 나머지만 넣는다.
 * - 넣은 유닛은 기본으로 초안(관리자가 확인한 뒤 공개).
 */
export function importUnits(data: unknown, opts: { apply: boolean; status?: UnitStatus }): ImportResult {
  const { units, problems } = flattenImport(data);
  const run = () => {
    const rows: ImportRow[] = [];
    // 코스별 섹션 이름 → id, 섹션별 유닛 이름 (이번에 넣는 것 포함)
    const sectionIds = new Map<string, Map<string, string>>();
    const titles = new Map<string, Set<string>>();
    const sectionsFor = (grade: NonNullable<(typeof units)[number]["grade"]>, subject: NonNullable<(typeof units)[number]["subject"]>) => {
      const key = `${grade}:${subject}`;
      if (!sectionIds.has(key)) {
        const outline = courseOutline(grade, subject, true);
        sectionIds.set(key, new Map(outline.sections.map((s) => [s.title, s.id])));
        for (const s of outline.sections) titles.set(s.id, new Set(s.units.map((u) => u.title)));
      }
      return sectionIds.get(key)!;
    };
    let added = 0;
    let sectionsAdded = 0;

    for (const u of units) {
      const row: ImportRow = { where: u.where, grade: u.grade ?? "", subject: u.subject ?? "", section: u.section, title: u.title, status: "ok", problems: [...u.problems], steps: 0, questions: 0, figures: 0, newSection: false };
      rows.push(row);
      if (row.problems.length || !u.grade || !u.subject) {
        row.status = "error";
        continue;
      }
      const fig = attachFigures(u.steps as unknown[], opts.apply);
      const check = sanitizeSteps(fig.steps);
      row.figures = fig.figures;
      row.steps = check.steps.length;
      row.questions = questionCount(check.steps);
      row.problems.push(...check.problems, ...fig.problems);
      // 단계 하나라도 잘못되면 유닛 전체를 건너뛴다 (반쪽짜리 유닛이 들어가지 않게)
      if (check.problems.length || fig.problems.length || check.steps.length === 0) {
        row.status = "error";
        if (check.steps.length === 0 && !check.problems.length) row.problems.push("쓸 수 있는 단계가 없어요.");
        continue;
      }
      const sections = sectionsFor(u.grade, u.subject);
      let sectionId = sections.get(u.section);
      row.newSection = !sectionId || sectionId.startsWith("new:");
      const known = sectionId ? titles.get(sectionId) : undefined;
      if (known?.has(u.title)) {
        row.status = "duplicate";
        row.problems.push("같은 섹션에 같은 이름의 유닛이 이미 있어서 건너뛰어요.");
        continue;
      }
      if (!opts.apply) {
        // 검사만: 같은 묶음 안의 중복도 알아볼 수 있게 이름을 기억해 둔다
        const fakeId = sectionId ?? `new:${u.grade}:${u.subject}:${u.section}`;
        if (!sectionId) sections.set(u.section, fakeId);
        if (!titles.has(fakeId)) titles.set(fakeId, new Set());
        titles.get(fakeId)!.add(u.title);
        continue;
      }
      if (!sectionId) {
        sectionId = createSection(u.grade, u.subject, u.section).id;
        sections.set(u.section, sectionId);
        titles.set(sectionId, new Set());
        sectionsAdded++;
      }
      const r = createUnit(sectionId, { title: u.title, steps: check.steps, status: opts.status ?? "draft" });
      if (r.problems) {
        row.status = "error";
        row.problems.push(...r.problems);
        continue;
      }
      row.unitId = r.unit.id;
      titles.get(sectionId)!.add(u.title);
      added++;
    }
    return { rows, problems, applied: opts.apply, added, sectionsAdded };
  };
  // 넣을 때는 한 번에 (중간에 실패하면 모두 되돌린다)
  return opts.apply ? transaction(run) : run();
}
