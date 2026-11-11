// 관리 도구 서버 실행 (Windows·macOS·Linux 공통)
//   node scripts/admin.mjs dev    → 개발 서버 (빌드 폴더 .next-admin)
//   node scripts/admin.mjs start  → 빌드한 결과로 실행 (먼저 npm run build)
// 포트는 ADMIN_PORT (환경 변수 또는 .env.local, 기본 3300)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const mode = process.argv[2] === "dev" ? "dev" : "start";

/** .env.local에서 값 하나 읽기 (Next가 나머지 값은 스스로 읽는다) */
function fromEnvFile(name) {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${name}=`));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}

const port = process.env.ADMIN_PORT || fromEnvFile("ADMIN_PORT") || "3300";
const env = { ...process.env, ADMIN_SERVER: "1" };
// 학생용 개발 서버(npm run dev)와 함께 띄워도 빌드 폴더가 겹치지 않게
if (mode === "dev") env.NEXT_DIST_DIR = ".next-admin";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, mode, "-p", port], { stdio: "inherit", env });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
