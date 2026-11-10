// Импорт Excel (.xlsx): читаем первый лист и передаём в тот же разбор, что и CSV.
import { parseRecords, ParseResult } from "./csv";
import { Lang, tr } from "./i18n";

type Cell = string | number | boolean | Date | null | undefined | object;

const cellText = (v: Cell): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export async function parseXlsx(buffer: ArrayBuffer, fileName: string, lang: Lang = "ru"): Promise<ParseResult> {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const name = fileName.replace(/\.xlsx$/i, "");
  let sheet: Cell[][];
  try {
    const { readSheet } = await import("read-excel-file/universal");
    sheet = (await readSheet(buffer)) as Cell[][];
  } catch {
    return {
      errors: [
        t(
          "Не удалось прочитать файл Excel. Сохраните его как .xlsx или CSV и попробуйте снова.",
          "Excel файлын оқу мүмкін болмады. Оны .xlsx немесе CSV ретінде сақтап, қайта көріңіз.",
        ),
      ],
      warnings: [],
    };
  }
  // Заголовок — первая строка, в которой заполнено хотя бы три ячейки
  const headerIdx = sheet.findIndex((row) => row.filter((v) => cellText(v) !== "").length >= 3);
  if (headerIdx < 0)
    return {
      errors: [t("На первом листе Excel не найдена таблица с заголовками.", "Excel-дің бірінші парағында тақырыптары бар кесте табылмады.")],
      warnings: [],
    };
  const fields = sheet[headerIdx].map((v, i) => cellText(v) || `column_${i + 1}`);
  const records = sheet
    .slice(headerIdx + 1)
    .filter((row) => row.some((v) => cellText(v) !== ""))
    .map((row) => Object.fromEntries(fields.map((f, i) => [f, cellText(row[i])])));
  return parseRecords(records, fields, name, lang);
}
