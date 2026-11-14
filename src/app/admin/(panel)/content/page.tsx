"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge, Td, Th } from "@/components/admin/AdminShell";
import { Select, TextInput } from "@/components/kit";
import { Card, cn } from "@/components/ui";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import { adminApi, ago } from "@/lib/admin/client";
import { courseName, gradeShort, subjectLabel } from "@/lib/learn/names";
import { classificationLabel } from "@/data/classification";

interface Item {
  id: string;
  kind: "material" | "quiz";
  sourceKind: string;
  grade: string;
  subject: string;
  subjectName: string;
  unit: string;
  topic: string;
  title: string;
  parentId: string | null;
  madeBy: string;
  uses: number;
  status: string;
  edited: boolean;
  updatedAt: number;
  children?: number;
}

const SOURCE: Record<string, string> = { web: "웹 검색", curriculum: "교과 단원", photo: "사진", pdf: "PDF", quiz: "문제" };

export default function AdminContent() {
  const [kind, setKind] = useState("material");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [groups, setGroups] = useState<Item[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"list" | "dup">("list");

  useEffect(() => {
    const p = new URLSearchParams({ kind, grade, subject, q: q.trim() });
    const t = setTimeout(() => {
      adminApi<{ items: Item[] }>(`/api/admin/bank?${p}`).then(
        (r) => {
          setItems(r.items);
        },
        (e) => setError(e.message),
      );
    }, 200);
    return () => clearTimeout(t);
  }, [kind, grade, subject, q]);

  useEffect(() => {
    if (tab !== "dup" || groups) return;
    adminApi<{ groups: Item[][] }>("/api/admin/bank/groups").then((r) => setGroups(r.groups), (e) => setError(e.message));
  }, [tab, groups]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">자료 모음</h1>
      <p className="text-sm text-ink-soft">학생들이 AI 학습실에서 만든 정리와 문제가 쌓여요. 같은 요청은 다시 만들지 않고 여기 있는 것을 줘요. 설명이나 정답이 틀린 곳은 열어서 고치세요.</p>
      <div className="flex gap-2" role="tablist">
        {(["list", "dup"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-full border-2 px-3 py-1 text-sm", tab === t ? "border-accent bg-accent text-white" : "border-line")}>
            {t === "list" ? "전체 목록" : "겹치는 자료"}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}

      {tab === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Select aria-label="종류" value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
              <option value="material">정리</option>
              <option value="quiz">문제 세트</option>
              <option value="">모두</option>
            </Select>
            <Select aria-label="학년" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-auto">
              <option value="">모든 학년</option>
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
            <Select aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
              <option value="">모든 과목</option>
              {SUBJECT_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·주제·단원 찾기" aria-label="자료 찾기" className="w-auto flex-1" />
          </div>
          {items && items.length === 0 && <Card className="text-sm text-ink-soft">조건에 맞는 자료가 없어요.</Card>}
          {items && items.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface" tabIndex={0} role="region" aria-label="자료 표 (옆으로 밀어서 보기)">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr>
                    <Th>제목</Th>
                    <Th>분류 (학년 · 과목 · 단원)</Th>
                    <Th>출처</Th>
                    <Th>쓰임</Th>
                    <Th>상태</Th>
                    <Th>바뀐 때</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <Td>
                        <Link href={`/admin/content/item?id=${it.id}`} className="font-display underline">
                          {it.title || "(제목 없음)"}
                        </Link>
                        <p className="text-xs text-ink-soft">{it.topic}</p>
                      </Td>
                      <Td>{classificationLabel({ grade: it.grade ? gradeShort(it.grade) : "", subject: it.subject ? subjectLabel(it.subject) : it.subjectName, unit: it.unit }) || "-"}</Td>
                      <Td className="whitespace-nowrap">
                        {SOURCE[it.sourceKind] ?? it.sourceKind}
                        {it.kind === "material" && <span className="block text-xs text-ink-soft">문제 {it.children ?? 0}세트</span>}
                      </Td>
                      <Td className="tabular-nums">{it.uses}</Td>
                      <Td>
                        <StatusBadge status={it.status} />
                        {it.edited && <span className="block text-xs text-ink-soft">고침</span>}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-soft">{ago(it.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "dup" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">학년·과목이 같고 주제가 많이 겹치는 자료예요. 학습 과정에서 섹션을 고른 뒤 이 자료들을 함께 골라 &lsquo;AI로 유닛 만들기&rsquo;를 하면 AI가 겹치는 내용을 하나로 정리해요.</p>
          {groups === null && <p className="text-ink-soft">찾는 중…</p>}
          {groups && groups.length === 0 && <Card className="text-sm text-ink-soft">겹치는 자료가 없어요.</Card>}
          {groups?.map((g, i) => (
            <Card key={i} className="space-y-1">
              <p className="text-xs text-ink-soft">
                {g[0].grade && g[0].subject ? courseName(g[0].grade, g[0].subject) : "과목 미상"} · {g.length}개
              </p>
              <ul className="space-y-0.5 text-sm">
                {g.map((it) => (
                  <li key={it.id}>
                    <Link href={`/admin/content/item?id=${it.id}`} className="underline">
                      {it.title}
                    </Link>{" "}
                    <span className="text-xs text-ink-soft">({it.topic})</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
