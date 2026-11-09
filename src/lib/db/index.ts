import Dexie, { type EntityTable } from "dexie";
import type * as T from "./types";
import { defaultCourseIds, type SubjectGroup } from "@/data/curriculum";

export class HomeStudyDB extends Dexie {
  profile!: EntityTable<T.Profile, "id">;
  subjects!: EntityTable<T.Subject, "id">;
  exams!: EntityTable<T.Exam, "id">;
  tasks!: EntityTable<T.Task, "id">;
  studySessions!: EntityTable<T.StudySession, "id">;
  decks!: EntityTable<T.Deck, "id">;
  cards!: EntityTable<T.Card, "id">;
  wrongAnswers!: EntityTable<T.WrongAnswer, "id">;
  materials!: EntityTable<T.Material, "id">;
  quizzes!: EntityTable<T.Quiz, "id">;
  questions!: EntityTable<T.Question, "id">;
  tutorChats!: EntityTable<T.TutorChat, "id">;
  tutorMessages!: EntityTable<T.TutorMessage, "id">;
  userQuests!: EntityTable<T.UserQuest, "id">;
  userBadges!: EntityTable<T.UserBadge, "id">;
  reflections!: EntityTable<T.Reflection, "id">;
  aiUsage!: EntityTable<T.AiUsage, "id">;
  xpEvents!: EntityTable<T.XpEvent, "id">;
  images!: EntityTable<T.StoredImage, "id">;

  constructor(name = "homestudy") {
    super(name);
    this.version(1).stores({
      profile: "id",
      subjects: "id, group",
      exams: "id, date",
      tasks: "id, date, subjectId, examId, [date+order]",
      studySessions: "id, date, subjectId",
      decks: "id, subjectId",
      cards: "id, deckId, due",
      wrongAnswers: "id, subjectId, nextRetry",
      materials: "id, kind, subjectId",
      quizzes: "id, subjectId",
      questions: "id, quizId",
      tutorChats: "id, updatedAt",
      tutorMessages: "id, chatId, createdAt",
      userQuests: "id, questId, period",
      userBadges: "id, badgeId",
      reflections: "id, week",
      aiUsage: "id, date",
      xpEvents: "id, date",
    });
    // v2: 1단계 기능 (과목·단원 연결, 할 일 종류, 오답 사진)
    this.version(2)
      .stores({ images: "id" })
      .upgrade(async (tx) => {
        const profile = await tx.table("profile").get("me");
        await tx
          .table("subjects")
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (!Array.isArray(s.courseIds)) {
              s.courseIds = profile ? defaultCourseIds(profile.grade, s.group as SubjectGroup) : [];
            }
            if (!Array.isArray(s.customUnits)) s.customUnits = [];
            // 차트에서 너무 밝던 0단계 수학 기본색을 조정
            if (s.color === "#f2a93b") s.color = "#d4881c";
          });
        await tx
          .table("tasks")
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            if (!t.kind) t.kind = "custom";
          });
      });
  }
}

let instance: HomeStudyDB | null = null;

export function getDB(): HomeStudyDB {
  if (!instance) instance = new HomeStudyDB();
  return instance;
}

/** 테스트용 */
export function setDB(db: HomeStudyDB) {
  instance = db;
}

export function newId(): string {
  return crypto.randomUUID();
}
