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
  /** Только для демо: что заложено в генератор (для проверки метода). */
  truth?: DemoTruth;
  /** Только для загруженных данных: результат проверки файла. */
  quality?: DataQuality;
}

export interface DataQuality {
  checks: { level: "ok" | "warn" | "info"; text: string }[];
}

/** Истинные закономерности синтетических данных. */
export interface DemoTruth {
  hardest: string;
  prereqs: { from: string; to: string; strength: number }[];
  bestTextbook: string;
  lag: { textbook: string; section: string };
  hoursPriority: string[];
  uneven: string;
  /** Истинный вклад школы (логит-шкала): общий и по разделам. */
  schoolEffect: Record<string, { overall: number; bySection: Record<string, number> }>;
}

export interface Filters {
  district: string; // "all" | district
  locality: string; // "all" | город | село
  language: string; // "all" | каз | рус
}

export type Level = "low" | "mid" | "good" | "high";
