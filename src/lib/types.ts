/** Одна строка входных данных: результат одного ученика за один раздел (СОР). */
export interface Row {
  district: string;
  school: string;
  locality: "город" | "село";
  language: "каз" | "рус";
  classId: string;
  studentId: string;
  textbook: string;
  section: string;
  sectionOrder: number;
  plannedHours: number;
  actualHours: number;
  score: number;
  maxScore: number;
  /** Итоговый результат ученика за прошлый год, % (стартовый уровень). */
  baselinePct: number;
}

export interface Dataset {
  name: string;
  subject: string;
  grade: string;
  region: string;
  synthetic: boolean;
  rows: Row[];
}

export interface Filters {
  district: string; // "all" | district
  locality: string; // "all" | город | село
  language: string; // "all" | каз | рус
}

export type Level = "low" | "mid" | "good" | "high";
