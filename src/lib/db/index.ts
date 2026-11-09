import Dexie, { type EntityTable } from "dexie";
import type * as T from "./types";

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
