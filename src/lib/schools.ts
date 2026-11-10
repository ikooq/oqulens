// Рекомендации для конкретной школы: что проседает, почему и к кому обратиться за опытом.

import { Analysis, SchoolProfile } from "./analytics";

export interface SchoolAction {
  tone: "risk" | "info" | "good";
  title: string;
  text: string;
}

const pp = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")} п.п.`;
const q = (s: string) => `«${s}»`;
const h1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");

export function schoolActions(a: Analysis, p: SchoolProfile): SchoolAction[] {
  const out: SchoolAction[] = [];
  const stat = (name: string) => a.sections.find((s) => s.name === name);
  const plan = (name: string) => a.hours.sections.find((h) => h.name === name);

  const below = p.sections.filter((s) => s.flag === "below").sort((x, y) => x.residual - y.residual);
  if (p.vaFlag === "below" && below.length >= 3) {
    out.push({
      tone: "risk",
      title: "Отставание по большинству разделов",
      text: `Школа ниже ожидаемого в ${below.length} разделах из ${p.sections.length} (в среднем ${pp(p.valueAdded)}). Это не трудность одной темы, а общая ситуация с преподаванием предмета: нужна комплексная поддержка — закрепить методиста, спланировать курсы повышения квалификации и наставничество для учителей математики.`,
    });
  }
  for (const s of below) {
    const st = stat(s.section);
    const mentors = p.mentors[s.section] ?? [];
    const mentorText = mentors.length
      ? ` Опыт можно перенять у: ${mentors
          .map((m) => `${m.school} (${m.sameDistrict ? "" : `${m.district}, `}${pp(m.residual)})`)
          .join("; ")}.`
      : "";
    const deps = a.prereqs.filter((l) => l.from === s.section).map((l) => l.to);
    const depText = deps.length ? ` Раздел — фундамент для ${deps.map(q).join(", ")}: пробелы лучше закрыть до перехода к ${deps.length > 1 ? "ним" : "нему"}.` : "";
    if (st?.systemic) {
      out.push({
        tone: "risk",
        title: `${q(s.section)}: трудный везде, а здесь ещё ниже`,
        text: `Раздел проседает по всей выборке, а в школе результат ещё на ${pp(s.residual).slice(1)} ниже ожидаемого для такого состава учеников (${Math.round(
          s.mean,
        )}% при ожидаемых ${Math.round(s.expected)}%). Нужны и системные меры, и разбор раздела с учителем.${depText}${mentorText}`,
      });
    } else {
      out.push({
        tone: "risk",
        title: `${q(s.section)}: ниже ожидаемого на ${pp(s.residual).slice(1)}`,
        text: `${Math.round(s.mean)}% при ожидаемых ${Math.round(
          s.expected,
        )}% для учеников с таким стартовым уровнем и учебником. В других школах раздел осваивается лучше, значит, вопрос в преподавании: взаимопосещение уроков, разбор заданий СОР с учителем.${depText}${mentorText}`,
      });
    }
  }

  // Часы: недодано по сравнению с планом в разделе, где школа проседает или раздел трудный
  for (const s of p.sections) {
    const sec = a.meta.sections.find((x) => x.name === s.section);
    if (!sec || !Number.isFinite(s.hours) || sec.planned <= 0) continue;
    const short = sec.planned - s.hours;
    const hp = plan(s.section);
    if (short >= 2 && (s.flag === "below" || stat(s.section)?.status === "hard") && hp && hp.perHour > 0.3) {
      out.push({
        tone: "info",
        title: `${q(s.section)}: недодано ${h1(short)} ч`,
        text: `Фактически ${h1(s.hours)} ч при ${sec.planned} ч по плану. В этом разделе каждый час заметно влияет на результат (+1 ч ≈ +${h1(
          hp.perHour,
        )} п.п.), поэтому часы стоит вернуть${hp.delta > 0 ? `, а по плану перераспределения — даже добавить ${hp.delta} ч` : ""}.`,
      });
    }
  }

  // Учебник: слабая глава того учебника, по которому учится школа
  for (const l of a.textbooks.lags.filter((l) => p.textbooks.includes(l.textbook))) {
    out.push({
      tone: "info",
      title: `${q(l.textbook)}: слабая глава ${q(l.section)}`,
      text: `При равном составе учеников этот учебник даёт в разделе на ${Math.abs(l.diffVsBest)
        .toFixed(1)
        .replace(".", ",")} п.п. меньше лучшего. Учителям школы нужны дополнительные материалы к этой главе.`,
    });
  }

  const above = p.sections.filter((s) => s.flag === "above").sort((x, y) => y.residual - x.residual);
  if (above.length) {
    out.push({
      tone: "good",
      title: `Сильная сторона: ${above.map((s) => q(s.section)).join(", ")}`,
      text: `Результат выше ожидаемого (${above.map((s) => `${q(s.section)} ${pp(s.residual)}`).join(", ")}). Опыт школы стоит тиражировать: открытый урок или семинар для учителей района.`,
    });
  }

  if (out.length === 0) {
    out.push({
      tone: "good",
      title: "Существенных отклонений нет",
      text: "По всем разделам результат школы в пределах ожидаемого для её состава учеников и учебника.",
    });
  }
  return out;
}
