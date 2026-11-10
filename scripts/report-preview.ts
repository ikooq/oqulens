// Печать методической записки по демо-данным (для проверки текста).
// npm run report            — по-русски
// npm run report -- kk      — по-казахски
import { generateDemo } from "../src/lib/generator";
import { analyze } from "../src/lib/analytics";
import { buildSummary } from "../src/lib/report";
import { buildReport } from "../src/lib/memo";
import type { Lang } from "../src/lib/i18n";

const lang: Lang = process.argv[2] === "kk" ? "kk" : "ru";
const a = analyze(generateDemo(2026, lang).rows)!;
const ctx = { title: lang === "kk" ? "Алгебра, 7-сынып — Жамбыл облысы" : "Алгебра, 7 класс — Жамбылская область", scope: lang === "kk" ? "барлық аудандар" : "все районы", synthetic: true, date: "10.11.2026" };
console.log(buildReport(a, ctx, lang));
console.log(`\n[summary for AI: ${JSON.stringify(buildSummary(a, ctx)).length} chars]`);
