"use client";

import { useState } from "react";
import { PageHeader } from "@/components/kit";
import { Pet } from "@/components/Pet";
import { toast } from "@/components/Toaster";
import { useUiStyle } from "@/components/ThemeSync";
import { Button, Card, SectionTitle, cn } from "@/components/ui";
import { SHOP_ITEMS, backgroundStyle, type ShopItem } from "@/data/shop";
import { buyItem, equipItem } from "@/lib/db/game";
import { terms } from "@/lib/game/companion";
import { usePetState } from "@/lib/hooks";

export default function CompanionPage() {
  const state = usePetState();
  const style = useUiStyle();
  const noir = style === "noir";
  const t = terms(style);
  const [preview, setPreview] = useState<{ accessory?: string; background?: string } | null>(null);
  if (!state) return null;
  const { profile, stage, mood } = state;
  const owned = new Set(profile.owned ?? []);
  const equipped = profile.equipped ?? {};
  const shown = { ...equipped, ...preview };

  async function onBuy(item: ShopItem) {
    const name = noir ? item.noirName : item.name;
    if (!confirm(`${name}을(를) ${item.price} 코인에 살까요?`)) return;
    const r = await buyItem(item.id);
    if (r === "ok") toast(`${name} 구매 완료!`);
    else if (r === "coins") toast("코인이 부족해요. 공부해서 경험치를 모으면 코인도 쌓여요.");
    setPreview(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={noir ? "동료 장비" : "🎀 펫 꾸미기"} back="/" />
      <Card className="overflow-hidden p-0 text-center">
        <div className="px-4 pb-2 pt-4" style={backgroundStyle(shown.background, noir)}>
          <p className="kicker text-left">Preview</p>
          <p className="font-display text-xl">{profile.pet.name}</p>
          <div className="flex justify-center py-2">
            <Pet species={profile.pet.species} stage={stage.stage === "egg" ? "baby" : stage.stage} mood={mood === "sleepy" ? "happy" : mood} size={170} accessory={shown.accessory} />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-ink-soft">{stage.stage === "egg" ? `${t.stageLabel("egg")} 상태에서는 장식이 보이지 않아요. 미리보기는 다음 단계 모습이에요.` : "아이템을 눌러 미리 볼 수 있어요"}</span>
          <span className="font-display shrink-0">🪙 {profile.coins}</span>
        </div>
      </Card>
      <p className="text-xs text-ink-soft">코인은 얻은 경험치 10마다 1개씩 쌓여요. 공부로만 모을 수 있어요.</p>

      {(["accessory", "background"] as const).map((kind) => (
        <section key={kind}>
          <SectionTitle>
            <span className="kicker">{kind === "accessory" ? "Accessories" : "Backdrops"}</span>
            {kind === "accessory" ? (noir ? "장신구" : "액세서리") : "배경"}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_ITEMS.filter((i) => i.kind === kind).map((item) => {
              const has = owned.has(item.id);
              const on = equipped[kind] === item.id;
              const previewing = preview?.[kind] === item.id;
              return (
                <Card key={item.id} className={cn("space-y-2 p-3", (on || previewing) && "border-accent")}>
                  <button type="button" className="w-full text-left" onClick={() => setPreview(previewing ? null : { [kind]: item.id })} aria-pressed={previewing}>
                    {kind === "background" && <span className="mb-2 block h-12 w-full border border-line" style={backgroundStyle(item.id, noir) ?? { background: "var(--surface-2)" }} aria-hidden />}
                    <span className="font-display block">{noir ? item.noirName : item.name}</span>
                    <span className="block text-xs text-ink-soft">{item.description}</span>
                  </button>
                  {has ? (
                    <Button size="sm" variant={on ? "ghost" : "accent"} className="w-full" onClick={() => equipItem(kind, on ? undefined : item.id).then(() => setPreview(null))}>
                      {on ? "벗기" : "착용"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" className="w-full" disabled={profile.coins < item.price} onClick={() => onBuy(item)}>
                      🪙 {item.price}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
