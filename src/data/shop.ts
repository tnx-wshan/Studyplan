import type { CSSProperties } from "react";

/** 코인으로 사는 꾸미기 아이템. 공부해서 얻은 코인으로만 살 수 있다. */
export interface ShopItem {
  id: string;
  kind: "accessory" | "background";
  name: string;
  noirName: string;
  price: number;
  description: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "halo", kind: "accessory", name: "반짝 고리", noirName: "황동 후광", price: 40, description: "머리 위에 떠 있는 빛의 고리" },
  { id: "glasses", kind: "accessory", name: "동그란 안경", noirName: "외알 안경", price: 30, description: "공부 잘하게 생긴 안경" },
  { id: "scarf", kind: "accessory", name: "빨간 목도리", noirName: "진홍 스카프", price: 50, description: "추운 날에도 공부할 수 있어요" },
  { id: "brooch", kind: "accessory", name: "별 배지", noirName: "인장 브로치", price: 80, description: "꾸준함의 증표" },
  { id: "night", kind: "background", name: "밤하늘", noirName: "자정의 창", price: 60, description: "별이 뜬 조용한 밤" },
  { id: "library", kind: "background", name: "도서관", noirName: "기록 보관소", price: 90, description: "책장이 늘어선 공간" },
  { id: "dusk", kind: "background", name: "노을", noirName: "황혼", price: 70, description: "하루를 마무리하는 시간" },
  { id: "crimson", kind: "background", name: "딸기 우유", noirName: "진홍 장막", price: 120, description: "특별한 날을 위한 배경" },
];

export function shopItem(id?: string) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** 펫 카드 배경 (스타일별) */
export function backgroundStyle(id: string | undefined, noir: boolean): CSSProperties | undefined {
  switch (id) {
    case "night":
      return noir
        ? { background: "radial-gradient(circle at 80% 15%, rgba(201,164,92,0.35) 0 2px, transparent 3px), radial-gradient(circle at 20% 30%, rgba(236,230,220,0.5) 0 1px, transparent 2px), linear-gradient(180deg, #0c0f1a, #1a1718)" }
        : { background: "radial-gradient(circle at 80% 15%, #fff 0 2px, transparent 3px), radial-gradient(circle at 20% 30%, #fff 0 1.5px, transparent 2.5px), linear-gradient(180deg, #2b3a7a, #6a5acd)" };
    case "library":
      return noir
        ? { background: "repeating-linear-gradient(90deg, #231d1c 0 22px, #2c2422 22px 24px), linear-gradient(180deg, #1a1718, #120f10)", backgroundBlendMode: "multiply" }
        : { background: "repeating-linear-gradient(90deg, #f3d9b1 0 22px, #e7c896 22px 24px)" };
    case "dusk":
      return noir ? { background: "linear-gradient(180deg, #3a1d24 0%, #5c2a22 45%, #1a1718 100%)" } : { background: "linear-gradient(180deg, #ffb07a 0%, #ff8fab 55%, #fff1dc 100%)" };
    case "crimson":
      return noir
        ? { background: "repeating-linear-gradient(90deg, #4a1015 0 14px, #5e161c 14px 28px), linear-gradient(180deg, #2a0a0d, #1a1718)" }
        : { background: "linear-gradient(180deg, #ffd1dc, #ffe9ef)" };
    default:
      return undefined;
  }
}
