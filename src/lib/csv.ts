// Импорт/экспорт CSV. Принимает заголовки на английском или русском.
import Papa from "papaparse";
import { Dataset, Row } from "./types";

export const COLUMNS: { key: keyof Row; csv: string; ru: string; required: boolean; hint: string }[] = [
  { key: "district", csv: "district", ru: "район", required: false, hint: "Район / город" },
  { key: "school", csv: "school", ru: "школа", required: true, hint: "Название или код школы" },
  { key: "locality", csv: "locality", ru: "местность", required: false, hint: "город / село" },
  { key: "language", csv: "language", ru: "язык", required: false, hint: "каз / рус" },
  { key: "classId", csv: "class_id", ru: "класс", required: true, hint: "Уникальный код класса" },
  { key: "studentId", csv: "student_id", ru: "ученик", required: true, hint: "Обезличенный ID ученика" },
  { key: "textbook", csv: "textbook", ru: "учебник", required: true, hint: "Учебник, по которому учится класс" },
  { key: "section", csv: "section", ru: "раздел", required: true, hint: "Раздел учебной программы (СОР)" },
  { key: "sectionOrder", csv: "section_order", ru: "номер_раздела", required: false, hint: "Порядковый номер раздела" },
  { key: "plannedHours", csv: "planned_hours", ru: "часы_план", required: false, hint: "Часы по долгосрочному плану" },
  { key: "actualHours", csv: "actual_hours", ru: "часы_факт", required: false, hint: "Фактически проведено часов" },
  { key: "score", csv: "score", ru: "балл", required: true, hint: "Балл за СОР" },
  { key: "maxScore", csv: "max_score", ru: "макс_балл", required: true, hint: "Максимальный балл СОР" },
  { key: "baselinePct", csv: "baseline_pct", ru: "стартовый_уровень", required: false, hint: "Итог прошлого года, %" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/ё/g, "е");

export interface ParseResult {
  dataset?: Dataset;
  errors: string[];
  warnings: string[];
}

export function parseCsv(text: string, fileName: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [",", ";", "\t"],
  });
  const headers = (parsed.meta.fields ?? []).map((h) => [h, norm(h)] as const);
  const colOf = new Map<keyof Row, string>();
  for (const c of COLUMNS) {
    const hit = headers.find(([, n]) => n === norm(c.csv) || n === norm(c.ru));
    if (hit) colOf.set(c.key, hit[0]);
    else if (c.required) errors.push(`Нет обязательного столбца «${c.csv}» (или «${c.ru}»).`);
  }
  if (errors.length) return { errors, warnings };
  for (const c of COLUMNS) if (!c.required && !colOf.has(c.key)) warnings.push(`Столбец «${c.csv}» не найден — часть анализа будет ограничена.`);

  const num = (v: string | undefined) => {
    if (v === undefined || v === "") return NaN;
    return Number(String(v).replace(",", "."));
  };
  const get = (r: Record<string, string>, k: keyof Row) => {
    const col = colOf.get(k);
    return col ? (r[col] ?? "").trim() : "";
  };
  const sectionOrderSeen = new Map<string, number>();
  const rows: Row[] = [];
  let bad = 0;
  for (const r of parsed.data) {
    const score = num(get(r, "score"));
    const maxScore = num(get(r, "maxScore"));
    const section = get(r, "section");
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || !section) {
      bad++;
      continue;
    }
    if (!sectionOrderSeen.has(section)) sectionOrderSeen.set(section, sectionOrderSeen.size + 1);
    const loc = norm(get(r, "locality"));
    const lang = norm(get(r, "language"));
    const planned = num(get(r, "plannedHours"));
    const actual = num(get(r, "actualHours"));
    const order = num(get(r, "sectionOrder"));
    const baseline = num(get(r, "baselinePct"));
    rows.push({
      district: get(r, "district") || "—",
      school: get(r, "school"),
      locality: loc.startsWith("сел") || loc.startsWith("rur") || loc.startsWith("аул") ? "село" : "город",
      language: lang.startsWith("рус") || lang.startsWith("ru") ? "рус" : "каз",
      classId: get(r, "classId"),
      studentId: get(r, "studentId"),
      textbook: get(r, "textbook") || "—",
      section,
      sectionOrder: Number.isFinite(order) ? order : sectionOrderSeen.get(section)!,
      plannedHours: Number.isFinite(planned) ? planned : Number.isFinite(actual) ? actual : 0,
      actualHours: Number.isFinite(actual) ? actual : Number.isFinite(planned) ? planned : 0,
      score: Math.max(0, Math.min(score, maxScore)),
      maxScore,
      baselinePct: Number.isFinite(baseline) ? baseline : 50,
    });
  }
  if (bad) warnings.push(`Пропущено строк с некорректным баллом или разделом: ${bad}.`);
  if (rows.length === 0) errors.push("В файле нет ни одной корректной строки.");
  const sectionsCount = new Set(rows.map((r) => r.section)).size;
  if (rows.length && sectionsCount < 2) warnings.push("Найден только один раздел — сравнение разделов недоступно.");

  return {
    errors,
    warnings,
    dataset: errors.length
      ? undefined
      : {
          name: fileName.replace(/\.csv$/i, ""),
          subject: "",
          grade: "",
          region: "",
          synthetic: false,
          rows,
        },
  };
}

export function toCsv(rows: Row[]): string {
  return Papa.unparse({
    fields: COLUMNS.map((c) => c.csv),
    data: rows.map((r) => COLUMNS.map((c) => r[c.key])),
  });
}

export function downloadText(text: string, fileName: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
