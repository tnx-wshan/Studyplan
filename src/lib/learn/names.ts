import { GRADES, SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";

/** "중학교 1학년" → "중1" */
export const gradeShort = (g: string) =>
  GRADES.find((x) => x.id === g)?.label.replace("중학교 ", "중").replace("고등학교 ", "고").replace("학년", "") ?? g;

export const subjectLabel = (s: string) => SUBJECT_GROUPS.find((x) => x.id === s)?.label ?? s;

/** "중1 수학" */
export const courseName = (grade: GradeId | string, subject: SubjectGroup | string) => `${gradeShort(grade)} ${subjectLabel(subject)}`;
