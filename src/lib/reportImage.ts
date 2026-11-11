import type { ReportStats } from "@/lib/study/report";

export interface ReportImageInput {
  title: string;
  periodLabel: string;
  nickname: string;
  stats: ReportStats;
  /** 계획 달성률(%) */
  rate: number | null;
  subjectName: (id: string) => string;
  /** CSS 변수에서 읽은 색 (없으면 기본값) */
  colors?: Partial<Record<"bg" | "surface" | "ink" | "inkSoft" | "primary" | "line", string>>;
}

const W = 1080;
const H = 1350;

function minutesText(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? (r ? `${h}시간 ${r}분` : `${h}시간`) : `${r}분`;
}

/** 주간·월간 리포트를 한 장의 그림(PNG)으로 그린다. 외부 글꼴 없이 앱의 글꼴을 그대로 쓴다. */
export function drawReportImage(input: ReportImageInput): HTMLCanvasElement {
  const c = { bg: "#17151f", surface: "#252233", ink: "#f4f1fa", inkSoft: "#b9b3c9", primary: "#ff9a52", line: "#3a3650", ...input.colors };
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const font = (px: number, weight = 400) => `${weight} ${px}px "Noto Sans KR", system-ui, sans-serif`;

  g.fillStyle = c.bg;
  g.fillRect(0, 0, W, H);

  const text = (s: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = "left") => {
    g.font = font(size, weight);
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(s, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, r = 36) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fillStyle = c.surface;
    g.fill();
    g.strokeStyle = c.line;
    g.lineWidth = 3;
    g.stroke();
  };

  text("홈스터디", 72, 110, 40, c.primary, 700);
  text(input.title, 72, 200, 72, c.ink, 700);
  text(`${input.periodLabel} · ${input.nickname}`, 72, 258, 36, c.inkSoft);

  const s = input.stats;
  const tiles: [string, string][] = [
    ["집중 시간", minutesText(s.totalMinutes)],
    ["공부한 날", `${s.studyDays} / ${s.days}일`],
    ["계획 달성률", input.rate === null ? "-" : `${input.rate}%`],
    ["얻은 경험치", `${s.xp} XP`],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 72 + (i % 2) * 468;
    const y = 310 + Math.floor(i / 2) * 200;
    box(x, y, 444, 176);
    text(label, x + 36, y + 62, 32, c.inkSoft);
    text(value, x + 36, y + 130, 56, c.ink, 700);
  });

  // 날짜별 집중 시간
  const chartY = 740;
  box(72, chartY, 936, 330);
  text("날짜별 집중 시간", 108, chartY + 62, 32, c.inkSoft);
  const days = s.byDay.slice(-31);
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const gap = 8;
  const bw = Math.min(70, (936 - 72 - gap * (days.length - 1)) / Math.max(1, days.length));
  const total = bw * days.length + gap * (days.length - 1);
  const x0 = 72 + (936 - total) / 2;
  days.forEach((d, i) => {
    const h = Math.max(6, (d.minutes / max) * 190);
    g.fillStyle = d.minutes > 0 ? c.primary : c.line;
    g.beginPath();
    g.roundRect(x0 + i * (bw + gap), chartY + 300 - h, bw, h, 8);
    g.fill();
  });

  // 가장 많이 한 과목
  const top = s.bySubject.slice(0, 3).map((b) => `${input.subjectName(b.subjectId)} ${minutesText(b.minutes)}`);
  text(top.length ? `많이 한 과목  ${top.join("  ·  ")}` : "이 기간에는 집중 기록이 없어요", 72, 1130, 34, c.ink);
  text(`카드 복습 ${s.cardsReviewed}장  ·  오답 정복 ${s.wrongMastered}개`, 72, 1190, 34, c.inkSoft);
  text("꾸준함이 실력이 돼요", W / 2, 1290, 34, c.inkSoft, 400, "center");
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))), "image/png"));
}

/** 휴대폰이면 공유 창을, 아니면 파일 저장을 연다. 저장했으면 "saved", 공유 창을 열었으면 "shared" */
export async function shareOrDownload(blob: Blob, filename: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "홈스터디 리포트" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
}
