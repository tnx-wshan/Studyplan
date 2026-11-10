"use client";

import { useUiStyle } from "./ThemeSync";
import { NOIR_SPECIES } from "@/lib/game/companion";
import { PET_SPECIES, type PetMood, type PetSpecies, type PetStage } from "@/lib/game/pet";

interface PetProps {
  species: PetSpecies;
  stage: PetStage;
  mood: PetMood;
  size?: number;
  className?: string;
  /** 착용한 꾸미기 아이템 id */
  accessory?: string;
  /** 지정하지 않으면 지금 화면 스타일을 따른다 */
  styleOverride?: "cute" | "noir";
}

const STAGE_SCALE: Record<PetStage, number> = { egg: 0.8, baby: 0.7, child: 0.82, teen: 0.92, adult: 1 };

/** 홈스터디 펫(귀여운 스타일) / 동료(누아르 스타일). 종류·성장 단계·기분에 따라 모양이 바뀐다. */
export function Pet({ species, stage, mood, size = 160, className, accessory, styleOverride }: PetProps) {
  const current = useUiStyle();
  const style = styleOverride ?? current;
  if (style === "noir") return <Companion species={species} stage={stage} mood={mood} size={size} className={className} accessory={accessory} />;
  const { color, accent } = PET_SPECIES[species];
  const animation = mood === "sleepy" || mood === "sad" ? "pet-slow" : "pet-bounce";
  const label = `${PET_SPECIES[species].label} (${stage === "egg" ? "알" : "성장 중"})`;

  return (
    <div className={className} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <ellipse cx="100" cy="186" rx="52" ry="8" fill="rgba(0,0,0,0.12)" />
        <g className={animation}>
          {stage === "egg" ? (
            <Egg color={color} accent={accent} />
          ) : (
            <g>
              <Body species={species} stage={stage} mood={mood} color={color} accent={accent} />
              {accessory && (
                <g transform={`translate(100 184) scale(${STAGE_SCALE[stage]}) translate(-100 -184)`}>
                  <Accessory id={accessory} anchors={{ head: 50, eye: 110, neck: 150, chest: 158 }} noir={false} />
                </g>
              )}
            </g>
          )}
        </g>
        {mood === "sleepy" && (
          <text x="150" y="60" className="pet-z font-display" fontSize="22" fill="var(--ink-soft)">
            z
          </text>
        )}
      </svg>
    </div>
  );
}

/** 꾸미기 아이템 (두 스타일 공용, 위치만 다르다) */
function Accessory({ id, anchors, noir }: { id: string; anchors: { head: number; eye: number; neck: number; chest: number }; noir: boolean }) {
  const gold = noir ? "#c9a45c" : "#ffc83d";
  switch (id) {
    case "halo":
      return <ellipse cx="100" cy={anchors.head - 14} rx="30" ry="7" fill="none" stroke={gold} strokeWidth="4" opacity="0.9" />;
    case "glasses":
      return noir ? (
        <g fill="none" stroke={gold} strokeWidth="2">
          <circle cx="100" cy={anchors.eye} r="11" />
          <path d={`M111 ${anchors.eye} q 8 10 4 30`} />
        </g>
      ) : (
        <g fill="none" stroke="#2d2a32" strokeWidth="4">
          <circle cx="76" cy={anchors.eye} r="15" />
          <circle cx="124" cy={anchors.eye} r="15" />
          <path d={`M91 ${anchors.eye} h18`} />
        </g>
      );
    case "scarf":
      return (
        <g fill={noir ? "#8e1f27" : "#f05454"}>
          <path d={`M62 ${anchors.neck - 6} Q100 ${anchors.neck + 10} 138 ${anchors.neck - 6} L136 ${anchors.neck + 6} Q100 ${anchors.neck + 22} 64 ${anchors.neck + 6} Z`} />
          <path d={`M118 ${anchors.neck + 8} l10 30 l-12 2 z`} />
        </g>
      );
    case "brooch":
      return noir ? (
        <g>
          <circle cx="100" cy={anchors.chest} r="8" fill="#1a1718" stroke={gold} strokeWidth="2" />
          <path d={`M100 ${anchors.chest - 4} l3 4 l-3 4 l-3 -4 z`} fill={gold} />
        </g>
      ) : (
        <path d={`M100 ${anchors.chest - 10} l3 7 h8 l-6 5 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -5 h8 z`} fill={gold} stroke="#e0a106" strokeWidth="1.5" />
      );
    default:
      return null;
  }
}

/** 누아르 스타일의 동료: 망토를 두른 실루엣과 빛나는 하나의 눈 */
function Companion({ species, stage, mood, size, className, accessory }: { species: PetSpecies; stage: PetStage; mood: PetMood; size: number; className?: string; accessory?: string }) {
  const glow = NOIR_SPECIES[species].glow;
  const dark = "#1c1819";
  const steel = "#4a4240";
  const s = STAGE_SCALE[stage];
  const label = `${NOIR_SPECIES[species].label} (${stage === "egg" ? "봉인" : "각성"})`;
  const float = mood === "sleepy" ? "" : "companion-float";
  const tier = { egg: 0, baby: 1, child: 2, teen: 3, adult: 4 }[stage];
  const eyeOpacity = mood === "sad" ? 0.45 : 1;

  return (
    <div className={className} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <defs>
          <radialGradient id={`glow-${species}`}>
            <stop offset="0%" stopColor={glow} stopOpacity="0.55" />
            <stop offset="100%" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="188" rx="46" ry="5" fill="rgba(0,0,0,0.5)" />
        <g className={float}>
          {stage === "egg" ? (
            <g>
              <circle cx="100" cy="112" r="62" fill={`url(#glow-${species})`} opacity={mood === "sleepy" ? 0.3 : 0.7} />
              <path d="M100 38 L138 92 L122 176 L78 176 L62 92 Z" fill={dark} stroke={steel} strokeWidth="2" />
              <path d="M100 38 L108 96 L100 176 M62 92 L108 96 L138 92" fill="none" stroke={steel} strokeWidth="1" />
              <path d="M92 110 L100 98 L108 110 L100 132 Z" fill="none" stroke={glow} strokeWidth="2" opacity={eyeOpacity} />
              <g stroke="#6b605c" strokeWidth="3" fill="none" opacity="0.9">
                <path d="M66 120 Q100 132 134 120" />
                <path d="M72 150 Q100 162 128 150" />
              </g>
            </g>
          ) : (
            <g transform={`translate(100 184) scale(${s}) translate(-100 -184)`}>
              <circle cx="100" cy="80" r="46" fill={`url(#glow-${species})`} opacity={mood === "sleepy" ? 0.2 : mood === "excited" ? 0.9 : 0.6} />
              {tier >= 3 && <ellipse cx="100" cy="42" rx="34" ry="6" fill="none" stroke={glow} strokeWidth="1.5" opacity="0.7" />}
              {tier >= 4 && (
                <g fill={glow} opacity="0.8">
                  <path d="M42 70 l6 -14 l4 16 z" />
                  <path d="M158 66 l-4 -16 l-6 14 z" />
                  <path d="M34 120 l8 -10 l2 12 z" />
                  <path d="M166 118 l-2 -12 l-8 10 z" />
                </g>
              )}
              {/* 망토 */}
              <path d="M74 104 L126 104 L152 184 L48 184 Z" fill={dark} stroke={steel} strokeWidth="2" />
              <path d="M100 108 L100 184 M86 112 L70 184 M114 112 L130 184" stroke="#2c2627" strokeWidth="1.5" />
              {tier >= 2 && (
                <g fill={dark} stroke={glow} strokeWidth="1.5">
                  <path d="M74 104 L56 116 L66 128 L80 112 Z" />
                  <path d="M126 104 L144 116 L134 128 L120 112 Z" />
                </g>
              )}
              {/* 칼라와 가슴 문양 */}
              <path d="M78 102 L100 116 L122 102 L114 98 L100 106 L86 98 Z" fill="#2a2425" stroke={steel} strokeWidth="1.5" />
              <SpeciesMark species={species} glow={glow} />
              {/* 머리: 육각형 투구 */}
              <path d="M100 52 L124 66 L124 92 L100 106 L76 92 L76 66 Z" fill={dark} stroke={steel} strokeWidth="2" />
              <path d="M76 66 L100 76 L124 66" fill="none" stroke="#2c2627" strokeWidth="1.5" />
              {mood === "sleepy" ? (
                <path d="M92 84 L108 84" stroke={glow} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
              ) : (
                <g opacity={eyeOpacity}>
                  {mood === "excited" && <circle cx="100" cy="84" r="11" fill="none" stroke={glow} strokeWidth="1" className="eye-pulse" />}
                  <circle cx="100" cy="84" r="5.5" fill={glow} />
                  <circle cx="100" cy="84" r="2" fill="#fff" opacity="0.8" />
                </g>
              )}
              {accessory && <Accessory id={accessory} anchors={{ head: 52, eye: 84, neck: 106, chest: 132 }} noir />}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function SpeciesMark({ species, glow }: { species: PetSpecies; glow: string }) {
  const common = { fill: "none", stroke: glow, strokeWidth: 1.8, strokeLinecap: "round" as const, opacity: 0.85 };
  if (species === "cloud") {
    return (
      <g {...common}>
        <path d="M88 136 q6 -5 12 0 t12 0" />
        <path d="M88 146 q6 -5 12 0 t12 0" />
        <path d="M92 156 q4 -4 8 0 t8 0" />
      </g>
    );
  }
  if (species === "sprout") {
    return (
      <g {...common}>
        <path d="M100 160 C100 148 92 142 100 132 C108 142 100 148 100 160" />
        <path d="M100 150 C108 148 112 142 110 136" />
      </g>
    );
  }
  return (
    <g {...common}>
      <path d="M100 128 L108 144 L100 160 L92 144 Z" />
      <path d="M100 138 L103 146 L100 152 L97 146 Z" fill={glow} />
    </g>
  );
}

function Egg({ color, accent }: { color: string; accent: string }) {
  return (
    <g>
      <path d="M100 30 C145 30 160 100 160 128 C160 162 134 184 100 184 C66 184 40 162 40 128 C40 100 55 30 100 30Z" fill="#fffaf0" stroke={accent} strokeWidth="5" />
      <path d="M48 120 L70 106 L88 122 L108 104 L128 122 L150 108" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="80" cy="80" r="8" fill={color} opacity="0.6" />
      <circle cx="122" cy="150" r="10" fill={color} opacity="0.6" />
      <circle cx="128" cy="70" r="5" fill={color} opacity="0.6" />
    </g>
  );
}

function Body({
  species,
  stage,
  mood,
  color,
  accent,
}: {
  species: PetSpecies;
  stage: Exclude<PetStage, "egg">;
  mood: PetMood;
  color: string;
  accent: string;
}) {
  const s = STAGE_SCALE[stage];
  return (
    <g transform={`translate(100 184) scale(${s}) translate(-100 -184)`}>
      {/* 종류별 장식 (몸 뒤) */}
      {species === "flame" && (
        <path d="M100 8 C116 34 132 40 128 70 C142 58 146 44 144 36 C162 60 160 84 150 100 L50 100 C40 84 40 60 58 40 C58 54 64 62 72 68 C70 40 86 30 100 8Z" fill={accent} />
      )}
      {species === "cloud" && (
        <g fill={color} stroke={accent} strokeWidth="5">
          <circle cx="56" cy="88" r="26" />
          <circle cx="144" cy="88" r="26" />
        </g>
      )}
      {/* 몸 */}
      <path
        d="M100 52 C150 52 170 96 170 132 C170 166 142 184 100 184 C58 184 30 166 30 132 C30 96 50 52 100 52Z"
        fill={color}
        stroke={accent}
        strokeWidth="5"
      />
      <ellipse cx="100" cy="148" rx="40" ry="26" fill="#ffffff" opacity="0.45" />
      {species === "sprout" && (
        <g>
          <path d="M100 54 L100 30" stroke={accent} strokeWidth="5" strokeLinecap="round" />
          <path d="M100 34 C88 14 66 16 62 26 C76 36 90 38 100 34Z" fill={color} stroke={accent} strokeWidth="4" />
          {(stage === "teen" || stage === "adult") && (
            <path d="M100 34 C112 14 134 16 138 26 C124 36 110 38 100 34Z" fill={color} stroke={accent} strokeWidth="4" />
          )}
        </g>
      )}
      {stage === "adult" && (
        <path d="M76 52 L84 34 L100 46 L116 34 L124 52 Z" fill="var(--xp)" stroke="var(--xp-deep)" strokeWidth="4" strokeLinejoin="round" />
      )}
      <Face mood={mood} accent={accent} />
      {/* 팔 */}
      <path d="M36 130 C24 126 20 140 30 146" fill={color} stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <path d="M164 130 C176 126 180 140 170 146" fill={color} stroke={accent} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

function Face({ mood, accent }: { mood: PetMood; accent: string }) {
  const ink = "#2d2a32";
  return (
    <g>
      {mood === "sleepy" ? (
        <g stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M66 112 Q76 120 86 112" />
          <path d="M114 112 Q124 120 134 112" />
        </g>
      ) : mood === "excited" ? (
        <g stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M66 116 Q76 102 86 116" />
          <path d="M114 116 Q124 102 134 116" />
        </g>
      ) : (
        <g className="pet-blink">
          <ellipse cx="76" cy="110" rx="9" ry="11" fill={ink} />
          <ellipse cx="124" cy="110" rx="9" ry="11" fill={ink} />
          <circle cx="79" cy="106" r="3" fill="#fff" />
          <circle cx="127" cy="106" r="3" fill="#fff" />
        </g>
      )}
      <ellipse cx="58" cy="130" rx="10" ry="6" fill="#ff7a9a" opacity="0.45" />
      <ellipse cx="142" cy="130" rx="10" ry="6" fill="#ff7a9a" opacity="0.45" />
      {mood === "sad" ? (
        <path d="M88 140 Q100 130 112 140" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : mood === "sleepy" ? (
        <ellipse cx="100" cy="138" rx="6" ry="5" fill={ink} />
      ) : (
        <path d="M86 132 Q100 148 114 132 Z" fill={ink} stroke={accent} strokeWidth="0" />
      )}
    </g>
  );
}
