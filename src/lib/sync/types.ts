import { z } from "zod";

/**
 * 기기 ↔ 서버 동기화 형식. 학생 데이터는 기기에 있고, 서버는 관리 도구가 볼 요약만 받는다.
 * 관리자가 값을 고치면 '명령'으로 쌓아 두었다가 기기가 다음에 접속할 때 적용한다.
 */

export const SnapshotSchema = z.object({
  level: z.number().int().min(1).max(10_000),
  totalXp: z.number().int().min(0),
  coins: z.number().int().min(0),
  freezes: z.number().int().min(0).max(10),
  streak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  /** 끝낸 학습 유닛 id */
  learnDone: z.array(z.string().max(64)).max(5000),
  /** 오늘·이번 주 학습 탭 공부 시간(초) */
  learnTodaySec: z.number().int().min(0),
  learnWeekSec: z.number().int().min(0),
  /** 고른 학습 코스 (학년:과목) */
  learnCourse: z.string().max(40).optional(),
  /** 마지막으로 공부한 날 (기기 시간대) */
  lastStudyDate: z.string().max(10).optional(),
});
export type UserSnapshot = z.infer<typeof SnapshotSchema>;

export const SyncRequestSchema = z.object({
  userId: z.uuid(),
  nickname: z.string().max(40),
  grade: z.string().max(10),
  snapshot: SnapshotSchema,
  /** 여기까지의 명령은 적용했다 */
  lastCommandId: z.number().int().min(0),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export const CommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setXp"), payload: z.object({ totalXp: z.number().int().min(0).max(10_000_000) }) }),
  z.object({ type: z.literal("setCoins"), payload: z.object({ coins: z.number().int().min(0).max(1_000_000) }) }),
  z.object({ type: z.literal("setFreezes"), payload: z.object({ freezes: z.number().int().min(0).max(2) }) }),
  z.object({ type: z.literal("setNickname"), payload: z.object({ nickname: z.string().trim().min(1).max(20) }) }),
  z.object({ type: z.literal("learnComplete"), payload: z.object({ unitId: z.string().max(64), courseKey: z.string().max(40) }) }),
  z.object({ type: z.literal("learnReset"), payload: z.object({ unitId: z.string().max(64) }) }),
  z.object({ type: z.literal("learnResetCourse"), payload: z.object({ courseKey: z.string().max(40) }) }),
]);
export type UserCommand = z.infer<typeof CommandSchema>;
export type CommandType = UserCommand["type"];

export interface StoredCommand {
  id: number;
  type: CommandType;
  payload: UserCommand["payload"];
  createdAt: number;
  appliedAt: number | null;
}

export type UserStatus = "active" | "suspended";

export interface SyncResponse {
  status: UserStatus;
  commands: StoredCommand[];
}

export const COMMAND_LABELS: Record<CommandType, string> = {
  setXp: "경험치 바꾸기",
  setCoins: "코인 바꾸기",
  setFreezes: "보호권 바꾸기",
  setNickname: "이름 바꾸기",
  learnComplete: "유닛 완료로 표시",
  learnReset: "유닛 진도 지우기",
  learnResetCourse: "코스 진도 모두 지우기",
};
