// Импорт/экспорт CSV. Принимает заголовки на английском, русском или казахском.
import Papa from "papaparse";
import { DataQuality, Dataset, Row } from "./types";
import { makeFmt, plural } from "./format";
import { Lang, tr } from "./i18n";
import { wideToLong } from "./journal";

export const COLUMNS: {
  key: keyof Row;
  csv: string;
  ru: string;
  kk: string;
  required: boolean;
  hint: string;
  hintKk: string;
  /** Другие названия столбца, которые тоже принимаем */
  aliases?: string[];
}[] = [
  { key: "district", csv: "district", ru: "район", kk: "аудан", required: false, hint: "Район / город", hintKk: "Аудан / қала" },
  { key: "school", csv: "school", ru: "школа", kk: "мектеп", required: true, hint: "Название или код школы", hintKk: "Мектептің атауы немесе коды", aliases: ["организация_образования", "школа_№", "school_name"] },
  { key: "locality", csv: "locality", ru: "местность", kk: "елді_мекен", required: false, hint: "город / село", hintKk: "қала / ауыл" },
  { key: "language", csv: "language", ru: "язык", kk: "тіл", required: false, hint: "каз / рус", hintKk: "қаз / орыс" },
  { key: "classId", csv: "class_id", ru: "класс", kk: "сынып", required: true, hint: "Уникальный код класса", hintKk: "Сыныптың бірегей коды", aliases: ["class", "класс_литер"] },
  { key: "studentId", csv: "student_id", ru: "ученик", kk: "оқушы", required: true, hint: "Обезличенный ID ученика", hintKk: "Оқушының иесіздендірілген ID-і", aliases: ["фио", "ф.и.о.", "фио_ученика", "ученик_фио", "аты-жөні", "аты_жөні", "оқушының_аты-жөні", "student"] },
  { key: "textbook", csv: "textbook", ru: "учебник", kk: "оқулық", required: true, hint: "Учебник, по которому учится класс", hintKk: "Сынып оқитын оқулық" },
  { key: "section", csv: "section", ru: "раздел", kk: "бөлім", required: true, hint: "Раздел учебной программы (СОР)", hintKk: "Оқу бағдарламасының бөлімі (БЖБ)" },
  { key: "sectionOrder", csv: "section_order", ru: "номер_раздела", kk: "бөлім_нөмірі", required: false, hint: "Порядковый номер раздела", hintKk: "Бөлімнің реттік нөмірі" },
  { key: "plannedHours", csv: "planned_hours", ru: "часы_план", kk: "сағат_жоспар", required: false, hint: "Часы по долгосрочному плану", hintKk: "Ұзақ мерзімді жоспар бойынша сағат" },
  { key: "actualHours", csv: "actual_hours", ru: "часы_факт", kk: "сағат_нақты", required: false, hint: "Фактически проведено часов", hintKk: "Нақты өткізілген сағат" },
  { key: "score", csv: "score", ru: "балл", kk: "балл", required: true, hint: "Балл за СОР", hintKk: "БЖБ балы" },
  { key: "maxScore", csv: "max_score", ru: "макс_балл", kk: "макс_балл", required: true, hint: "Максимальный балл СОР", hintKk: "БЖБ-ның ең жоғары балы" },
  { key: "baselinePct", csv: "baseline_pct", ru: "стартовый_уровень", kk: "бастапқы_деңгей", required: false, hint: "Итог прошлого года, %", hintKk: "Өткен жылдың қорытындысы, %" },
  {
    key: "period",
    csv: "period",
    ru: "учебный_год",
    kk: "оқу_жылы",
    required: false,
    hint: "Учебный год, например 2025–2026 — чтобы сравнить результаты разных лет",
    hintKk: "Оқу жылы, мысалы 2025–2026 — жылдарды салыстырып, өзгерістердің нәтижесін тексеру үшін",
    aliases: ["год", "период", "year", "school_year", "жыл", "кезең"],
  },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/ё/g, "е");

export interface ParseResult {
  dataset?: Dataset;
  errors: string[];
  warnings: string[];
}

export function parseCsv(text: string, fileName: string, lang: Lang = "ru"): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [",", ";", "\t"],
  });
  return parseRecords(parsed.data, parsed.meta.fields ?? [], fileName.replace(/\.csv$/i, ""), lang);
}

/** Общий разбор таблицы (из CSV или Excel): поиск столбцов, проверка и отчёт о качестве данных. */
export function parseRecords(data: Record<string, string>[], fields: string[], name: string, lang: Lang = "ru"): ParseResult {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const errors: string[] = [];
  const warnings: string[] = [];
  // Таблица «как в журнале» (ученики × СОР) разворачивается в длинный формат
  const wide = wideToLong(
    data,
    fields,
    name,
    COLUMNS.map((c) => ({ csv: c.csv, names: [c.csv, c.ru, c.kk, ...(c.aliases ?? [])] })),
    lang,
  );
  if (wide?.errors.length) return { errors: wide.errors, warnings };
  if (wide) {
    data = wide.data;
    fields = wide.fields;
  }
  const notes = wide?.notes ?? [];
  const headers = fields.map((h) => [h, norm(h)] as const);
  const colOf = new Map<keyof Row, string>();
  for (const c of COLUMNS) {
    const names = [c.csv, c.ru, c.kk, ...(c.aliases ?? [])].map(norm);
    const hit = headers.find(([, n]) => names.includes(n));
    if (hit) colOf.set(c.key, hit[0]);
    else if (c.required)
      errors.push(
        t(`Нет обязательного столбца «${c.ru}» (или «${c.csv}»).`, `Міндетті «${c.kk}» бағаны жоқ (немесе «${c.csv}»).`),
      );
  }
  if (errors.length) return { errors, warnings };
  for (const c of COLUMNS)
    if (!c.required && !colOf.has(c.key) && c.key !== "period" && !(wide && c.key === "sectionOrder"))
      warnings.push(t(`Столбец «${c.ru}» не найден — часть анализа будет ограничена.`, `«${c.kk}» бағаны табылмады — талдаудың бір бөлігі шектеледі.`));

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
    const key = JSON.stringify([get(r, "school"), get(r, "classId"), get(r, "studentId"), section, get(r, "period")]);
    if (seen.has(key)) duplicates++;
    seen.add(key);
    if (score < 0 || score > maxScore) clamped++;
    if (!sectionOrderSeen.has(section)) sectionOrderSeen.set(section, sectionOrderSeen.size + 1);
    const loc = norm(get(r, "locality"));
    const lng = norm(get(r, "language"));
    const planned = num(get(r, "plannedHours"));
    const actual = num(get(r, "actualHours"));
    const order = num(get(r, "sectionOrder"));
    const baseline = num(get(r, "baselinePct"));
    const period = get(r, "period");
    if (!Number.isFinite(baseline)) baselineMissing++;
    if (!Number.isFinite(actual)) hoursMissing++;
    rows.push({
      district: get(r, "district") || "—",
      school: get(r, "school"),
      locality: loc.startsWith("сел") || loc.startsWith("rur") || loc.startsWith("аул") || loc.startsWith("ауыл") ? "село" : loc.startsWith("гор") || loc.startsWith("urb") || loc.startsWith("қала") ? "город" : "неизвестно",
      language: lng.startsWith("рус") || lng.startsWith("ru") || lng.startsWith("орыс") ? "рус" : lng.startsWith("каз") || lng.startsWith("қаз") || lng.startsWith("kk") ? "каз" : "неизвестно",
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
      ...(!Number.isFinite(baseline) ? { baselineMissing: true } : {}),
      ...(period ? { period } : {}),
    });
  }
  if (bad) warnings.push(t(`Пропущено строк с некорректным баллом или разделом: ${bad}.`, `Балы немесе бөлімі қате жолдар өткізілді: ${bad}.`));
  if (rows.length === 0) errors.push(t("В файле нет ни одной корректной строки.", "Файлда бірде-бір дұрыс жол жоқ."));
  const sectionsCount = new Set(rows.map((r) => r.section)).size;
  if (rows.length && sectionsCount < 2)
    warnings.push(t("Найден только один раздел — сравнение разделов недоступно.", "Тек бір бөлім табылды — бөлімдерді салыстыру мүмкін емес."));

  const quality = errors.length
    ? undefined
    : buildQuality(rows, { total: data.length, bad, noId, clamped, baselineMissing, hoursMissing, duplicates, colOf }, lang);
  if (quality) quality.checks.splice(1, 0, ...notes.map((text) => ({ level: "info" as const, text })));

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
  lang: Lang,
): DataQuality {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const f = makeFmt(lang);
  const checks: DataQuality["checks"] = [];
  const unknownLocality = rows.filter((r) => r.locality === "неизвестно").length;
  const unknownLanguage = rows.filter((r) => r.language === "неизвестно").length;
  if (unknownLocality || unknownLanguage) checks.push({
    level: "warn",
    text: t(`Неизвестная местность: ${unknownLocality} строк; неизвестный язык: ${unknownLanguage} строк. Данные сохранены как неизвестные, сравнения ограничены.`, `Белгісіз елді мекен: ${unknownLocality} жол; белгісіз тіл: ${unknownLanguage} жол. Деректер белгісіз ретінде сақталды, салыстырулар шектеулі.`),
  });
  const n = (x: number) => x.toLocaleString("ru-RU");
  const students = new Set(rows.map((r) => JSON.stringify([r.school, r.classId, r.studentId]))).size;
  const schools = new Set(rows.map((r) => r.school));
  const classes = new Set(rows.map((r) => JSON.stringify([r.school, r.classId]))).size;
  const sections = new Set(rows.map((r) => r.section)).size;
  const textbooks = new Set(rows.map((r) => r.textbook)).size;
  const counts = `${f.nStudents(students)}, ${f.nSchools(schools.size)}, ${f.nClasses(classes)}, ${f.nSections(sections)}`;
  checks.push({
    level: "ok",
    text: t(`Прочитано ${n(rows.length)} из ${n(c.total)} строк: ${counts}.`, `${n(c.total)} жолдың ${n(rows.length)}-і оқылды: ${counts}.`),
  });
  if (c.bad)
    checks.push({
      level: "warn",
      text: t(`Пропущено строк без балла, максимального балла или раздела: ${n(c.bad)}.`, `Балы, ең жоғары балы немесе бөлімі жоқ жолдар өткізілді: ${n(c.bad)}.`),
    });
  if (c.noId)
    checks.push({
      level: "warn",
      text: t(`Пропущено строк без ученика, класса или школы: ${n(c.noId)}.`, `Оқушысы, сыныбы немесе мектебі жоқ жолдар өткізілді: ${n(c.noId)}.`),
    });
  if (c.duplicates)
    checks.push({
      level: "warn",
      text: t(
        `Повторов (ученик дважды в одном разделе): ${n(c.duplicates)}. Учтена последняя запись.`,
        `Қайталанулар (бір оқушы бір бөлімде екі рет): ${n(c.duplicates)}. Соңғы жазба ескерілді.`,
      ),
    });
  if (c.clamped)
    checks.push({
      level: "warn",
      text: t(
        `Баллов вне диапазона от 0 до максимума: ${n(c.clamped)}. Они приведены к границе.`,
        `0-ден ең жоғары балға дейінгі ауқымнан тыс балдар: ${n(c.clamped)}. Олар шекке келтірілді.`,
      ),
    });
  if (!c.colOf.has("baselinePct"))
    checks.push({
      level: "warn",
      text: t(
        "Нет стартового уровня учеников (итог прошлого года). Сравнение учебников и школ не сможет учесть разницу в подготовке учеников.",
        "Оқушылардың бастапқы деңгейі (өткен жылдың қорытындысы) жоқ. Оқулықтар мен мектептерді салыстыру оқушылар дайындығындағы айырмашылықты ескере алмайды.",
      ),
    });
  else if (c.baselineMissing)
    checks.push({
      level: "warn",
      text: t(
        `Результатов без стартового уровня: ${n(c.baselineMissing)}. Поправка на стартовый уровень отключена для всего анализа.`,
        `Бастапқы деңгейі жоқ нәтижелер: ${n(c.baselineMissing)}. Бүкіл талдауда бастапқы деңгейге түзету өшірілді.`,
      ),
    });
  if (!c.colOf.has("actualHours"))
    checks.push({
      level: "warn",
      text: t(
        "Нет фактических часов по классам — рекомендации по часам будут недоступны.",
        "Сыныптар бойынша нақты сағаттар жоқ — сағат бойынша ұсыныстар қолжетімсіз болады.",
      ),
    });
  else if (c.hoursMissing)
    checks.push({
      level: "info",
      text: t(
        `Результатов без фактических часов: ${n(c.hoursMissing)}. Для них взяты часы по плану.`,
        `Нақты сағаты жоқ нәтижелер: ${n(c.hoursMissing)}. Оларға жоспардағы сағат алынды.`,
      ),
    });
  if (textbooks < 2)
    checks.push({
      level: "info",
      text: t("Во всех классах один учебник — сравнение учебников недоступно.", "Барлық сыныпта бір оқулық — оқулықтарды салыстыру мүмкін емес."),
    });
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
      text: t(
        `Меньше 10 учащихся: ${f.nSchools(small)}. Их оценки менее надёжны и осторожно сдвигаются к среднему.`,
        `10-нан аз оқушы: ${f.nSchools(small)}. Олардың бағалары сенімділігі төмен, сондықтан ортаға қарай сақтықпен жылжытылады.`,
      ),
    });
  if (checks.length === 1)
    checks.push({ level: "ok", text: t("Пропусков, повторов и ошибок в баллах не найдено.", "Бос орындар, қайталанулар және балдағы қателер табылмады.") });
  return { checks };
}

/** Несколько файлов (например, по классу или по школе в каждом) — в один набор данных. */
export function mergeDatasets(parts: { file: string; dataset: Dataset }[], lang: Lang = "ru"): Dataset {
  if (parts.length === 1) return parts[0].dataset;
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const rows = parts.flatMap((p) => p.dataset.rows);
  const f = makeFmt(lang);
  const students = new Set(rows.map((r) => JSON.stringify([r.school, r.classId, r.studentId]))).size;
  const schools = new Set(rows.map((r) => r.school)).size;
  const classes = new Set(rows.map((r) => JSON.stringify([r.school, r.classId]))).size;
  const checks: DataQuality["checks"] = [
    {
      level: "ok",
      text: t(
        `Объединено файлов: ${parts.length} — ${f.nStudents(students)}, ${f.nSchools(schools)}, ${f.nClasses(classes)}.`,
        `Біріктірілген файлдар: ${parts.length} — ${f.nStudents(students)}, ${f.nSchools(schools)}, ${f.nClasses(classes)}.`,
      ),
    },
  ];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  for (const r of rows) {
    const key = JSON.stringify([r.district, r.school, r.classId, r.studentId, r.section, r.period ?? ""]);
    if (seenKeys.has(key)) duplicateCount++;
    seenKeys.add(key);
  }
  if (duplicateCount) checks.push({ level: "warn", text: t(`Повторов между файлами: ${duplicateCount}. Для каждого ученика и раздела используется последняя запись; проверьте файлы.`, `Файлдар арасындағы қайталану: ${duplicateCount}. Әр оқушы мен бөлім бойынша соңғы жазба қолданылады; файлдарды тексеріңіз.`) });
  for (const p of parts)
    for (const c of p.dataset.quality?.checks ?? [])
      if (c.level !== "ok" || p === parts[0]) checks.push({ level: c.level, text: `«${p.file}»: ${c.text}` });
  return {
    name: t(`Загруженные данные (${parts.length} ${plural(parts.length, ["файл", "файла", "файлов"])})`, `Жүктелген деректер (${parts.length} файл)`),
    subject: "",
    grade: "",
    region: "",
    synthetic: false,
    rows,
    quality: { checks },
  };
}

/** Таблица для Excel: заголовки на языке интерфейса (их понимает и импорт). */
export function toSheetRows(rows: Row[], lang: Lang = "ru"): (string | number)[][] {
  const kk = lang === "kk";
  const val = (r: Row, k: keyof Row) => k === "baselinePct" && r.baselineMissing ? "" :
    kk && k === "locality" ? (r.locality === "село" ? "ауыл" : r.locality === "город" ? "қала" : "белгісіз") : kk && k === "language" ? (r.language === "рус" ? "орыс" : r.language === "каз" ? "қаз" : "белгісіз") : (typeof r[k] === "boolean" ? String(r[k]) : r[k] ?? "");
  return [COLUMNS.map((c) => (kk ? c.kk : c.ru)), ...rows.map((r) => COLUMNS.map((c) => val(r, c.key)))];
}

/** Описание столбцов для второго листа шаблона. */
export function columnsHelpRows(lang: Lang = "ru"): string[][] {
  const kk = lang === "kk";
  return [
    kk ? ["Баған", "Міндетті", "Не көрсету керек"] : ["Столбец", "Обязательный", "Что указать"],
    ...COLUMNS.map((c) => [kk ? c.kk : c.ru, c.required ? (kk ? "иә" : "да") : kk ? "жоқ" : "нет", kk ? c.hintKk : c.hint]),
  ];
}

export function toCsv(rows: Row[]): string {
  return Papa.unparse({
    fields: COLUMNS.map((c) => c.csv),
    data: rows.map((r) => COLUMNS.map((c) => c.key === "baselinePct" && r.baselineMissing ? "" : r[c.key] ?? "")),
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
