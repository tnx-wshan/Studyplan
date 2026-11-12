import { GRADES, SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";
import { gradeShort } from "./names";

/**
 * 학습 유닛 일괄 넣기 형식 읽기. 다른 AI 에이전트가 만든 JSON을 받는다.
 *
 * { "grade": "m1", "subject": "math", "section": "소인수분해",
 *   "units": [ { "title": "…", "section"(선택): "…", "steps": [ …학습 단계… ] } ] }
 *
 * 위 객체 하나, 그 배열, 또는 ```json 으로 감싼 글도 받는다.
 * 단계(steps)의 검사는 서버가 sanitizeSteps로 한다. 단계에 "figure"(SVG)가 있으면 그림으로 저장한다.
 */

export interface ImportUnitInput {
  /** 몇 번째 코스의 몇 번째 유닛인지 (보고용) */
  where: string;
  grade: GradeId | null;
  /** 적힌 과목 그대로 (기본 과목 id·이름, 추가한 과목 이름). 서버가 학년의 과목에서 찾는다 */
  subject: string | null;
  section: string;
  title: string;
  steps: unknown;
  /** 단계 검사 전에 찾은 문제 (학년·과목·섹션·이름이 없음 등) */
  problems: string[];
}

/** "m1", "중학교 1학년", "중1" → m1 */
export function toGrade(v: unknown): GradeId | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return GRADES.find((g) => g.id === s || g.label === s || gradeShort(g.id) === s.replace(/\s+/g, ""))?.id ?? null;
}

/** "math", "수학" → math */
export function toSubject(v: unknown): SubjectGroup | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return SUBJECT_GROUPS.find((g) => g.id === s || g.label === s)?.id ?? null;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 글자로 받았으면 JSON으로 읽는다. ```json 감싸기, 앞뒤 설명 글은 떼어 낸다 */
export function readImportText(input: string): { data: unknown; error?: string } {
  let s = input.trim().replace(/^﻿/, "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 앞뒤에 설명 글이 붙어 있으면 첫 { 또는 [ 부터 마지막 } 또는 ] 까지만
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start < 0 || end < start) return { data: null, error: "JSON을 찾지 못했어요. { 로 시작하는 내용을 붙여 넣어 주세요." };
  const body = s.slice(start, end + 1);
  try {
    return { data: JSON.parse(body) };
  } catch (first) {
    // 다른 AI가 자주 내는 실수를 고쳐서 한 번 더 읽는다
    const repaired = repairJsonText(body);
    try {
      return { data: JSON.parse(repaired) };
    } catch (e) {
      return { data: null, error: describeJsonError(repaired, e instanceof Error ? e : first instanceof Error ? first : new Error(String(e))) };
    }
  }
}

/** 그림(SVG) 값 뒤에 올 수 있는 다음 항목 이름들 */
const NEXT_KEY = "(?:type|title|prompt|body|points|choices|answer|answers|explanation|text|distractors|decoys|math|figure|section|steps|units)";

/**
 * 자주 나오는 JSON 실수 고치기:
 * 1) "figure": "<svg viewBox="0 0 10 10">…" 처럼 그림 속 큰따옴표를 그대로 쓴 경우 → 따옴표를 이스케이프
 * 2) \( \) \[ \] \dots 처럼 JSON에서 허용하지 않는 백슬래시 표기 → 백슬래시를 두 번으로
 */
export function repairJsonText(text: string): string {
  const figure = new RegExp(`("figure"\\s*:\\s*)"(<svg[\\s\\S]*?)"(?=\\s*(?:,\\s*"${NEXT_KEY}"\\s*:|\\}))`, "g");
  let out = text.replace(figure, (_, head: string, raw: string) => {
    // 이미 이스케이프된 부분은 풀었다가 다시 한 번에 이스케이프한다
    const svg = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\r?\n/g, " ");
    return head + JSON.stringify(svg);
  });
  out = out.replace(/\\(?:(["\\/bfnrt])|u([0-9a-fA-F]{4})|([\s\S]))/g, (whole, ok?: string, hex?: string, bad?: string) => (bad !== undefined ? `\\\\${bad}` : whole));
  return out;
}

/** JSON이 깨진 곳의 줄·칸과 근처 글, 그리고 흔한 원인을 알려준다 */
function describeJsonError(text: string, e: Error): string {
  const pos = Number(e.message.match(/position (\d+)/)?.[1] ?? NaN);
  if (!Number.isFinite(pos)) return `JSON 형식이 올바르지 않아요: ${e.message}`;
  const before = text.slice(0, pos);
  const line = before.split("\n").length;
  const col = pos - before.lastIndexOf("\n");
  const near = text.slice(Math.max(0, pos - 60), pos).replace(/\s+/g, " ") + " ⟪여기⟫ " + text.slice(pos, pos + 40).replace(/\s+/g, " ");
  const hints: string[] = [];
  const around = text.slice(Math.max(0, pos - 300), pos + 50);
  if (/<svg|<text|<line|<rect/i.test(around)) hints.push("그림(SVG) 안에서 깨졌어요. SVG 속성은 작은따옴표(')로 쓰고, 값 끝에 </svg>가 있는지 확인하세요.");
  if (/"\s*\n\s*"/.test(around)) hints.push("항목 사이에 쉼표(,)가 빠졌을 수 있어요.");
  if (/,\s*[}\]]/.test(text.slice(Math.max(0, pos - 5), pos + 5))) hints.push("마지막 항목 뒤의 쉼표(,)를 지우세요.");
  return [`JSON 형식이 올바르지 않아요 (${line}번째 줄, ${col}번째 칸).`, `근처: …${near.trim()}…`, ...hints].join("\n");
}

/** 코스(들)를 유닛 목록으로 펼친다. 형식이 틀린 곳은 유닛마다 문제로 남긴다 */
export function flattenImport(data: unknown): { units: ImportUnitInput[]; problems: string[] } {
  const courses = Array.isArray(data) ? data : [data];
  const units: ImportUnitInput[] = [];
  const problems: string[] = [];
  courses.forEach((raw, ci) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const label = courses.length > 1 ? `${ci + 1}번째 코스` : "코스";
    if (!Array.isArray(c.units)) {
      problems.push(`${label}: "units" 배열이 없어요.`);
      return;
    }
    const grade = toGrade(c.grade);
    const subject = typeof c.subject === "string" && c.subject.trim() ? (toSubject(c.subject) ?? c.subject.trim()) : null;
    c.units.forEach((rawUnit, ui) => {
      const u = (rawUnit ?? {}) as Record<string, unknown>;
      const p: string[] = [];
      if (!grade) p.push(`학년 "${String(c.grade ?? "")}"을(를) 알 수 없어요 (m1~m3, h1~h3).`);
      if (!subject) p.push("과목(subject)이 없어요.");
      const section = text(u.section) || text(c.section);
      if (!section) p.push("섹션 이름이 없어요.");
      const title = text(u.title);
      if (!title) p.push("유닛 이름(title)이 없어요.");
      if (!Array.isArray(u.steps) || u.steps.length === 0) p.push("단계(steps)가 없어요.");
      units.push({ where: `${courses.length > 1 ? `${ci + 1}-` : ""}${ui + 1}`, grade, subject, section, title: title.slice(0, 60), steps: u.steps, problems: p });
    });
  });
  if (units.length === 0 && problems.length === 0) problems.push("넣을 유닛이 없어요.");
  return { units, problems };
}
