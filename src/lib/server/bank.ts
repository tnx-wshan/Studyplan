import "server-only";
import { createHash } from "node:crypto";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import type { StoredQuestion } from "@/lib/ai/schemas";
import { repairDeep } from "@/lib/ai/text";
import { newServerId, parseJson, serverDb } from "./db";

/**
 * 자료 모음: AI 학습실에서 만든 핵심 정리(material)와 문제(quiz)를 모아 둔다.
 *  - 같은 내용을 다시 만들려 하면 AI를 부르지 않고 모아 둔 것을 돌려준다 (사용자마다·사용자끼리 반복 생성 방지)
 *  - AI를 쓸 수 없는 학생도 '모두의 자료실'에서 꺼내 쓴다
 *  - 관리 도구에서 고치고, 섹션별 유닛을 만들 때 재료로 쓴다
 */

export type BankKind = "material" | "quiz";
export type BankStatus = "active" | "hidden";

export interface MaterialData {
  summary: string;
  keyPoints: string[];
  sources: { title: string; url: string }[];
  notice?: string;
}

export interface QuizData {
  questions: StoredQuestion[];
  verified: boolean;
  difficulty: "easy" | "normal" | "hard";
}

export interface BankItem<D = MaterialData | QuizData> {
  id: string;
  kind: BankKind;
  lookupKey: string;
  sourceKind: string;
  grade: string;
  subject: string;
  subjectName: string;
  topic: string;
  title: string;
  data: D;
  parentId: string | null;
  createdBy: string | null;
  madeBy: string;
  uses: number;
  status: BankStatus;
  edited: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  kind: string;
  lookup_key: string;
  source_kind: string;
  grade: string;
  subject: string;
  subject_name: string;
  topic: string;
  title: string;
  data: string;
  parent_id: string | null;
  created_by: string | null;
  made_by: string;
  uses: number;
  status: string;
  edited: number;
  created_at: number;
  updated_at: number;
}

function toItem(r: Row): BankItem {
  return {
    id: r.id,
    kind: r.kind as BankKind,
    lookupKey: r.lookup_key,
    sourceKind: r.source_kind,
    grade: r.grade,
    subject: r.subject,
    subjectName: r.subject_name,
    topic: r.topic,
    title: r.title,
    data: parseJson(r.data, {} as MaterialData),
    parentId: r.parent_id,
    createdBy: r.created_by,
    madeBy: r.made_by,
    uses: Number(r.uses),
    status: r.status === "hidden" ? "hidden" : "active",
    edited: !!r.edited,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ───────── 같은 내용 알아보기 ─────────

/** 주제 글자를 비교용으로: 띄어쓰기·문장 부호·대소문자를 뺀다 ("광합성과 호흡의 차이?" = "광합성과호흡의차이") */
export function topicKey(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 32);

/** 학년 글자("고등학교 1학년")나 id("h1")를 id로 */
export function gradeId(grade: string | undefined): string {
  if (!grade) return "";
  return GRADES.find((g) => g.id === grade || g.label === grade)?.id ?? "";
}

/** 과목 그룹 id나 과목 이름("수학")을 그룹 id로 */
export function subjectId(group: string | undefined, name?: string): string {
  if (group && SUBJECT_GROUPS.some((g) => g.id === group)) return group;
  if (name) return SUBJECT_GROUPS.find((g) => name.startsWith(g.label))?.id ?? "";
  return "";
}

export interface MaterialLookupInput {
  kind: "web" | "curriculum" | "photo" | "pdf";
  grade: string;
  subject: string;
  /** 웹 검색어, "과목 단원", 또는 사진·PDF 데이터 */
  topic: string;
}

/** 자료 정리 요청의 열쇠. 사진·PDF는 파일 내용 자체로 같은지 본다 */
export function materialLookupKey(input: MaterialLookupInput): string {
  const t = input.kind === "photo" || input.kind === "pdf" ? sha(input.topic) : topicKey(input.topic);
  return ["material", input.kind, input.grade, input.subject, t].join("|");
}

/** 문제 만들기 요청의 열쇠: 같은 자료로 같은 조건의 문제를 다시 만들지 않는다 */
export function quizLookupKey(input: { material: string; count: number; types: string[]; difficulty: string }): string {
  return ["quiz", sha(input.material), input.count, [...input.types].sort().join(","), input.difficulty].join("|");
}

// ───────── 읽기·쓰기 ─────────

export function findByKey(lookupKey: string): BankItem | null {
  const r = serverDb().prepare("SELECT * FROM bank_items WHERE lookup_key = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1").get(lookupKey) as Row | undefined;
  return r ? toItem(r) : null;
}

export function getItem(id: string): BankItem | null {
  const r = serverDb().prepare("SELECT * FROM bank_items WHERE id = ?").get(id) as Row | undefined;
  return r ? toItem(r) : null;
}

export interface NewItem {
  kind: BankKind;
  lookupKey: string;
  sourceKind: string;
  grade: string;
  subject: string;
  subjectName?: string;
  topic: string;
  title: string;
  data: MaterialData | QuizData;
  parentId?: string | null;
  createdBy?: string | null;
  madeBy?: string;
}

export function addItem(item: NewItem, now = Date.now()): BankItem {
  const id = newServerId();
  serverDb()
    .prepare(
      `INSERT INTO bank_items (id, kind, lookup_key, source_kind, grade, subject, subject_name, topic, title, data, parent_id, created_by, made_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      item.kind,
      item.lookupKey,
      item.sourceKind,
      item.grade,
      item.subject,
      item.subjectName ?? "",
      item.topic.slice(0, 200),
      item.title.slice(0, 100),
      JSON.stringify(repairDeep(item.data)),
      item.parentId ?? null,
      item.createdBy ?? null,
      item.madeBy ?? "",
      now,
      now,
    );
  return getItem(id)!;
}

export function markUsed(id: string) {
  serverDb().prepare("UPDATE bank_items SET uses = uses + 1 WHERE id = ?").run(id);
}

export function updateItem(id: string, patch: { title?: string; topic?: string; grade?: string; subject?: string; status?: BankStatus; data?: MaterialData | QuizData }, now = Date.now()) {
  const cur = getItem(id);
  if (!cur) return null;
  serverDb()
    .prepare("UPDATE bank_items SET title = ?, topic = ?, grade = ?, subject = ?, status = ?, data = ?, edited = 1, updated_at = ? WHERE id = ?")
    .run(
      (patch.title ?? cur.title).slice(0, 100),
      (patch.topic ?? cur.topic).slice(0, 200),
      patch.grade ?? cur.grade,
      patch.subject ?? cur.subject,
      patch.status ?? cur.status,
      JSON.stringify(repairDeep(patch.data ?? cur.data)),
      now,
      id,
    );
  return getItem(id);
}

/** 자료를 지우면 그 자료로 만든 문제도 함께 지운다 */
export function deleteItem(id: string) {
  const db = serverDb();
  db.prepare("DELETE FROM bank_items WHERE parent_id = ?").run(id);
  db.prepare("DELETE FROM bank_items WHERE id = ?").run(id);
}

export interface ListFilter {
  kind?: BankKind;
  grade?: string;
  subject?: string;
  q?: string;
  includeHidden?: boolean;
  limit?: number;
}

export function listItems(filter: ListFilter = {}): (BankItem & { children: number })[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const add = (sql: string, value: string) => {
    where.push(sql);
    args.push(value);
  };
  if (filter.kind) add("b.kind = ?", filter.kind);
  if (filter.grade) add("b.grade = ?", filter.grade);
  if (filter.subject) add("b.subject = ?", filter.subject);
  if (!filter.includeHidden) where.push("b.status = 'active'");
  if (filter.q?.trim()) {
    where.push("(b.title LIKE ? OR b.topic LIKE ?)");
    const like = `%${filter.q.trim().replace(/[%_]/g, "")}%`;
    args.push(like, like);
  }
  const rows = serverDb()
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM bank_items c WHERE c.parent_id = b.id AND c.status = 'active') AS children
       FROM bank_items b ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY b.updated_at DESC LIMIT ?`,
    )
    .all(...args, Math.min(filter.limit ?? 100, 500)) as unknown as (Row & { children: number })[];
  return rows.map((r) => ({ ...toItem(r), children: Number(r.children) }));
}

export function childrenOf(id: string, includeHidden = false): BankItem[] {
  const rows = serverDb()
    .prepare(`SELECT * FROM bank_items WHERE parent_id = ? ${includeHidden ? "" : "AND status = 'active'"} ORDER BY created_at`)
    .all(id) as unknown as Row[];
  return rows.map(toItem);
}

export function bankCounts() {
  const r = serverDb().prepare("SELECT SUM(kind = 'material') AS materials, SUM(kind = 'quiz') AS quizzes, SUM(uses) AS uses FROM bank_items").get() as Record<string, number | null>;
  return { materials: Number(r.materials ?? 0), quizzes: Number(r.quizzes ?? 0), reuses: Number(r.uses ?? 0) };
}

// ───────── 비슷한 자료 묶기 (유닛 만들기 재료 고르기) ─────────

/** 두 글자 조각(bigram) 집합 */
function bigrams(text: string): Set<string> {
  const t = topicKey(text);
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  if (t.length === 1) set.add(t);
  return set;
}

/** 0~1: 두 주제가 얼마나 겹치는지 */
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let both = 0;
  for (const g of x) if (y.has(g)) both++;
  return both / Math.min(x.size, y.size);
}

/** 섹션(목차)에 어울리는 자료를 비슷한 순서로 */
export function suggestForSection(section: { grade: string; subject: string; title: string }, limit = 30) {
  const items = listItems({ kind: "material", subject: section.subject, limit: 500 });
  return items
    .map((it) => ({ item: it, score: Math.max(similarity(section.title, it.topic), similarity(section.title, it.title)) + (it.grade === section.grade ? 0.15 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 중복으로 보이는 자료 묶음: 학년·과목이 같고 주제가 많이 겹치는 것끼리.
 * 관리자가 묶음을 보고 정리하거나 한 유닛으로 합친다.
 */
export function duplicateGroups(threshold = 0.6): BankItem[][] {
  const items = listItems({ kind: "material", limit: 500 });
  const used = new Set<string>();
  const groups: BankItem[][] = [];
  for (const a of items) {
    if (used.has(a.id)) continue;
    const group = [a];
    for (const b of items) {
      if (b.id === a.id || used.has(b.id) || b.subject !== a.subject || b.grade !== a.grade) continue;
      if (similarity(a.topic || a.title, b.topic || b.title) >= threshold) group.push(b);
    }
    if (group.length > 1) {
      group.forEach((x) => used.add(x.id));
      groups.push(group);
    }
  }
  return groups;
}
