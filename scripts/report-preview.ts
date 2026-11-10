// Печать методической записки по демо-данным (для проверки текста).
import { generateDemo } from "../src/lib/generator";
import { analyze } from "../src/lib/analytics";
import { buildReport, buildSummary } from "../src/lib/report";

const a = analyze(generateDemo(2026).rows)!;
const ctx = { title: "Алгебра, 7 класс — Жамбылская область", scope: "все районы", synthetic: true, date: "10 ноября 2026" };
console.log(buildReport(a, ctx));
console.log(`\n[summary for AI: ${JSON.stringify(buildSummary(a, ctx)).length} chars]`);
