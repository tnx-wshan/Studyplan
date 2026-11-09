import { PET_SPECIES, type PetMood, type PetSpecies, type PetStage } from "@/lib/game/pet";

interface PetProps {
  species: PetSpecies;
  stage: PetStage;
  mood: PetMood;
  size?: number;
  className?: string;
}

const STAGE_SCALE: Record<PetStage, number> = { egg: 0.8, baby: 0.7, child: 0.82, teen: 0.92, adult: 1 };

/** 홈스터디 펫. 종류·성장 단계·기분에 따라 모양이 바뀐다. */
export function Pet({ species, stage, mood, size = 160, className }: PetProps) {
  const { color, accent } = PET_SPECIES[species];
  const animation = mood === "sleepy" || mood === "sad" ? "pet-slow" : "pet-bounce";
  const label = `${PET_SPECIES[species].label} (${stage === "egg" ? "알" : "성장 중"})`;

  return (
    <div className={className} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <ellipse cx="100" cy="186" rx="52" ry="8" fill="rgba(0,0,0,0.12)" />
        <g className={animation}>
          {stage === "egg" ? <Egg color={color} accent={accent} /> : <Body species={species} stage={stage} mood={mood} color={color} accent={accent} />}
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
