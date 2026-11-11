// Импорт «как в журнале»: строки — ученики, столбцы — СОР (СОР 1, СОР 2 … или БЖБ 1, БЖБ 2 …).
// Так выглядят выгрузки электронных журналов и сводные таблицы учителей.
// Таблица разворачивается в формат «ученик × СОР», ФИО заменяются обезличенными кодами.

import type { Lang } from "./i18n";
import { tr } from "./i18n";

export interface WideResult {
  data: Record<string, string>[];
  fields: string[];
  errors: string[];
  notes: string[];
}

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/ё/g, "е");

/** Заголовок столбца СОР: номер, название раздела и (если указан) максимальный балл. */
const SOR_RE = /^\s*(?:СОР|БЖБ|SOR|сор|бжб)\s*№?\s*(\d{1,2})\b(.*)$/i;

export interface SorHeader {
  col: string;
  order: number;
  section: string;
  max?: number;
}

export function parseSorHeader(col: string): SorHeader | null {
  const m = col.match(SOR_RE);
  if (!m) return null;
  const order = Number(m[1]);
  let rest = m[2];
  let max: number | undefined;
  // «(15)», «(макс 15)», «(max. 15 баллов)», «/ 15», «из 15», «макс 15»
  const pats = [
    /\(\s*(?:макс(?:имум)?\.?|max\.?|ең\s+жоғары|из)?\s*(\d{1,3})\s*(?:балл\S*|б\.?|ұпай)?\s*\)/i,
    /(?:\/|(?:^|\s)(?:из|макс(?:имум)?\.?|max\.?))\s*(\d{1,3})\s*(?:балл\S*|б\.?)?\s*$/i,
  ];
  for (const p of pats) {
    const mm = rest.match(p);
    if (mm) {
      max = Number(mm[1]);
      rest = rest.replace(p, "");
      break;
    }
  }
  const section = rest.replace(/^[\s.:\-–—,]+|[\s.:\-–—,]+$/g, "").trim();
  return { col, order, section: section || `СОР ${order}`, max };
}

/** Короткий детерминированный хеш (FNV-1a) — для обезличенных кодов учеников. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

const MAX_ROW = /^(макс|max|ең\s*жоғары|максимальный|макс\.?\s*балл)/i;

/** Названия метаданных, которые ищем в «широкой» таблице (в том же виде, что и в длинной). */
export interface MetaColumn {
  csv: string;
  names: string[];
}

/**
 * Если таблица «широкая» (несколько столбцов СОР и нет столбцов «раздел»/«балл»),
 * разворачивает её в длинный формат с английскими заголовками. Иначе возвращает null.
 */
export function wideToLong(
  data: Record<string, string>[],
  fields: string[],
  fileName: string,
  meta: MetaColumn[],
  lang: Lang = "ru",
): WideResult | null {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const find = (csv: string) => {
    const m = meta.find((x) => x.csv === csv);
    if (!m) return undefined;
    const names = m.names.map(norm);
    return fields.find((f) => names.includes(norm(f)));
  };
  if (find("section") || find("score")) return null;
  const sor = fields.map(parseSorHeader).filter((x): x is SorHeader => !!x);
  if (sor.length < 2) return null;

  const errors: string[] = [];
  const notes: string[] = [];
  const studentCol = find("student_id");
  const schoolCol = find("school");
  const classCol = find("class_id");

  // Строка с максимальными баллами (если их нет в заголовках)
  const firstCol = fields[0];
  const maxRowIdx = data.findIndex((r) => [studentCol, firstCol].some((c) => c && MAX_ROW.test((r[c] ?? "").trim())));
  if (maxRowIdx >= 0) {
    const mr = data[maxRowIdx];
    for (const s of sor) {
      const v = Number(String(mr[s.col] ?? "").replace(",", "."));
      if (s.max === undefined && Number.isFinite(v) && v > 0) s.max = v;
    }
  }
  const noMax = sor.filter((s) => s.max === undefined);
  if (noMax.length) {
    errors.push(
      t(
        `Не найден максимальный балл для ${noMax.map((s) => `«${s.col}»`).join(", ")}. Укажите его в заголовке, например «СОР 1 (макс 15)», или добавьте строку «макс» с максимальными баллами.`,
        `${noMax.map((s) => `«${s.col}»`).join(", ")} үшін ең жоғары балл табылмады. Оны тақырыпта көрсетіңіз, мысалы «БЖБ 1 (макс 15)», немесе ең жоғары балдары бар «макс» жолын қосыңыз.`,
      ),
    );
    return { data: [], fields: [], errors, notes };
  }
  if (!studentCol) {
    errors.push(
      t(
        "Не найден столбец с учениками («ученик», «ФИО» или «student_id»).",
        "Оқушылар бағаны табылмады («оқушы», «аты-жөні» немесе «student_id»).",
      ),
    );
    return { data: [], fields: [], errors, notes };
  }

  const base = fileName.trim() || "file";
  const passthrough = meta
    .map((m) => ({ csv: m.csv, col: find(m.csv) }))
    .filter((x) => x.col && !["student_id", "school", "class_id"].includes(x.csv)) as { csv: string; col: string }[];

  const out: Record<string, string>[] = [];
  data.forEach((r, i) => {
    if (i === maxRowIdx) return;
    const raw = (r[studentCol] ?? "").trim();
    if (!raw) return;
    const school = (schoolCol ? r[schoolCol] : "")?.trim() || base;
    const cls = (classCol ? r[classCol] : "")?.trim() || base;
    // ФИО и номера по списку превращаются в код: один и тот же ученик в разных файлах получит тот же код
    const id = `S-${hash(`${school}\u0000${cls}\u0000${raw.toLowerCase()}`)}`;
    for (const s of sor) {
      const v = (r[s.col] ?? "").trim();
      if (!v || v === "-" || v === "—" || /^н\/?[ая]?$/i.test(v)) continue; // пропуск / «н» — не писал
      const rec: Record<string, string> = {
        school,
        class_id: cls,
        student_id: id,
        section: s.section,
        section_order: String(s.order),
        score: v,
        max_score: String(s.max),
        textbook: "—",
      };
      for (const p of passthrough) rec[p.csv] = (r[p.col] ?? "").trim() || rec[p.csv] || "";
      out.push(rec);
    }
  });

  notes.push(
    t(
      `Таблица распознана как журнал: ${sor.length} СОР (${sor.map((s) => s.section).join(", ")}).`,
      `Кесте журнал ретінде танылды: ${sor.length} БЖБ (${sor.map((s) => s.section).join(", ")}).`,
    ),
  );
  if (/[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүІі]{2,}/.test(data.map((r) => r[studentCol] ?? "").join(" ")))
    notes.push(
      t(
        "ФИО учеников заменены обезличенными кодами прямо в браузере — имена нигде не сохраняются и никуда не передаются.",
        "Оқушылардың аты-жөні браузердің өзінде иесіздендірілген кодтармен ауыстырылды — есімдер ешқайда сақталмайды және жіберілмейді.",
      ),
    );
  if (!schoolCol || !classCol)
    notes.push(
      t(
        `Нет столбца ${!schoolCol ? "«школа»" : ""}${!schoolCol && !classCol ? " и " : ""}${!classCol ? "«класс»" : ""} — использовано имя файла «${base}».`,
        `${!schoolCol ? "«мектеп»" : ""}${!schoolCol && !classCol ? " және " : ""}${!classCol ? "«сынып»" : ""} бағаны жоқ — «${base}» файл атауы қолданылды.`,
      ),
    );
  if (!find("textbook"))
    notes.push(
      t(
        "Учебник не указан — добавьте столбец «учебник», чтобы сравнивать учебники.",
        "Оқулық көрсетілмеген — оқулықтарды салыстыру үшін «оқулық» бағанын қосыңыз.",
      ),
    );
  const fieldsOut = ["school", "class_id", "student_id", "section", "section_order", "score", "max_score", "textbook", ...passthrough.map((p) => p.csv)];
  return { data: out, fields: [...new Set(fieldsOut)], errors, notes };
}
