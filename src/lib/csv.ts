// Импорт/экспорт CSV. Принимает заголовки на английском или русском.
import Papa from "papaparse";
import { DataQuality, Dataset, Row } from "./types";
import { nClasses, nSchools, nSections, nStudents } from "./format";

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
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [",", ";", "\t"],
  });
  return parseRecords(parsed.data, parsed.meta.fields ?? [], fileName.replace(/\.csv$/i, ""));
}

/** Общий разбор таблицы (из CSV или Excel): поиск столбцов, проверка и отчёт о качестве данных. */
export function parseRecords(data: Record<string, string>[], fields: string[], name: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const headers = fields.map((h) => [h, norm(h)] as const);
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
  let noId = 0;
  let clamped = 0;
  let baselineMissing = 0;
  let hoursMissing = 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const r of data) {
    const score = num(get(r, "score"));
    const maxScore = num(get(r, "maxScore"));
    const section = get(r, "section");
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || !section) {
      bad++;
      continue;
    }
    if (!get(r, "studentId") || !get(r, "school") || !get(r, "classId")) {
      noId++;
      continue;
    }
    const key = `${get(r, "studentId")}\u0000${section}`;
    if (seen.has(key)) duplicates++;
    seen.add(key);
    if (score < 0 || score > maxScore) clamped++;
    if (!sectionOrderSeen.has(section)) sectionOrderSeen.set(section, sectionOrderSeen.size + 1);
    const loc = norm(get(r, "locality"));
    const lang = norm(get(r, "language"));
    const planned = num(get(r, "plannedHours"));
    const actual = num(get(r, "actualHours"));
    const order = num(get(r, "sectionOrder"));
    const baseline = num(get(r, "baselinePct"));
    if (!Number.isFinite(baseline)) baselineMissing++;
    if (!Number.isFinite(actual)) hoursMissing++;
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

  const quality = errors.length
    ? undefined
    : buildQuality(rows, { total: data.length, bad, noId, clamped, baselineMissing, hoursMissing, duplicates, colOf });

  return {
    errors,
    warnings,
    dataset: errors.length
      ? undefined
      : {
          name,
          subject: "",
          grade: "",
          region: "",
          synthetic: false,
          rows,
          quality,
        },
  };
}

function buildQuality(
  rows: Row[],
  c: {
    total: number;
    bad: number;
    noId: number;
    clamped: number;
    baselineMissing: number;
    hoursMissing: number;
    duplicates: number;
    colOf: Map<keyof Row, string>;
  },
): DataQuality {
  const checks: DataQuality["checks"] = [];
  const n = (x: number) => x.toLocaleString("ru-RU");
  const students = new Set(rows.map((r) => r.studentId)).size;
  const schools = new Set(rows.map((r) => r.school));
  const classes = new Set(rows.map((r) => r.classId)).size;
  const sections = new Set(rows.map((r) => r.section)).size;
  const textbooks = new Set(rows.map((r) => r.textbook)).size;
  checks.push({
    level: "ok",
    text: `Прочитано ${n(rows.length)} из ${n(c.total)} строк: ${nStudents(students)}, ${nSchools(schools.size)}, ${nClasses(classes)}, ${nSections(sections)}.`,
  });
  if (c.bad) checks.push({ level: "warn", text: `Пропущено строк без балла, максимального балла или раздела: ${n(c.bad)}.` });
  if (c.noId) checks.push({ level: "warn", text: `Пропущено строк без ученика, класса или школы: ${n(c.noId)}.` });
  if (c.duplicates)
    checks.push({ level: "warn", text: `Повторов (ученик дважды в одном разделе): ${n(c.duplicates)}. Учтена последняя запись.` });
  if (c.clamped) checks.push({ level: "warn", text: `Баллов вне диапазона от 0 до максимума: ${n(c.clamped)}. Они приведены к границе.` });
  if (!c.colOf.has("baselinePct"))
    checks.push({
      level: "warn",
      text: "Нет стартового уровня учеников (итог прошлого года). Сравнение учебников и школ не сможет учесть разницу в подготовке учеников.",
    });
  else if (c.baselineMissing)
    checks.push({ level: "warn", text: `Результатов без стартового уровня: ${n(c.baselineMissing)}. Для них подставлено 50%.` });
  if (!c.colOf.has("actualHours"))
    checks.push({ level: "warn", text: "Нет фактических часов по классам — рекомендации по часам будут недоступны." });
  else if (c.hoursMissing) checks.push({ level: "info", text: `Результатов без фактических часов: ${n(c.hoursMissing)}. Для них взяты часы по плану.` });
  if (textbooks < 2) checks.push({ level: "info", text: "Во всех классах один учебник — сравнение учебников недоступно." });
  const perSchool = new Map<string, Set<string>>();
  for (const r of rows) {
    let s = perSchool.get(r.school);
    if (!s) perSchool.set(r.school, (s = new Set()));
    s.add(r.studentId);
  }
  const small = [...perSchool.values()].filter((s) => s.size < 10).length;
  if (small)
    checks.push({
      level: "info",
      text: `Меньше 10 учащихся: ${nSchools(small)}. Их оценки менее надёжны и осторожно сдвигаются к среднему.`,
    });
  if (checks.length === 1) checks.push({ level: "ok", text: "Пропусков, повторов и ошибок в баллах не найдено." });
  return { checks };
}

/** Таблица для Excel: русские заголовки (их понимает и импорт). */
export function toSheetRows(rows: Row[]): (string | number)[][] {
  return [COLUMNS.map((c) => c.ru), ...rows.map((r) => COLUMNS.map((c) => r[c.key]))];
}

/** Описание столбцов для второго листа шаблона. */
export function columnsHelpRows(): string[][] {
  return [["Столбец", "Обязательный", "Что указать"], ...COLUMNS.map((c) => [c.ru, c.required ? "да" : "нет", c.hint])];
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
