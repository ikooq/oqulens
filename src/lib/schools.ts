// Рекомендации для конкретной школы: что проседает, почему и к кому обратиться за опытом.

import { Analysis, SchoolProfile } from "./analytics";
import { Lang, tr } from "./i18n";

export interface SchoolAction {
  tone: "risk" | "info" | "good";
  title: string;
  text: string;
}

const q = (s: string) => `«${s}»`;
const h1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");

export function schoolActions(a: Analysis, p: SchoolProfile, lang: Lang = "ru"): SchoolAction[] {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const u = t("п.п.", "п.т.");
  const pp = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")} ${u}`;
  const ppAbs = (x: number) => `${Math.abs(x).toFixed(1).replace(".", ",")} ${u}`;
  const out: SchoolAction[] = [];
  const stat = (name: string) => a.sections.find((s) => s.name === name);
  const plan = (name: string) => a.hours.sections.find((h) => h.name === name);

  const below = p.sections.filter((s) => s.flag === "below").sort((x, y) => x.residual - y.residual);
  if (p.vaFlag === "below" && below.length >= 3) {
    out.push({
      tone: "risk",
      title: t("Отставание по большинству разделов", "Бөлімдердің көпшілігі бойынша артта қалу"),
      text: t(
        `Школа ниже ожидаемого в ${below.length} разделах из ${p.sections.length} (в среднем ${pp(p.valueAdded)}). Это не трудность одной темы, а общая ситуация с преподаванием предмета: нужна комплексная поддержка — закрепить методиста, спланировать курсы повышения квалификации и наставничество для учителей.`,
        `Мектеп ${p.sections.length} бөлімнің ${below.length}-інде күтілгеннен төмен (орта есеппен ${pp(p.valueAdded)}). Бұл бір тақырыптың қиындығы емес, пәнді оқытудағы жалпы жағдай: кешенді қолдау қажет — әдіскер бекіту, біліктілікті арттыру курстары мен мұғалімдерге тәлімгерлік ұйымдастыру.`,
      ),
    });
  }
  for (const s of below) {
    const st = stat(s.section);
    const mentors = p.mentors[s.section] ?? [];
    const mentorText = mentors.length
      ? t(" Опыт можно перенять у: ", " Тәжірибе алуға болатын мектептер: ") +
        mentors.map((m) => `${m.school} (${m.sameDistrict ? "" : `${m.district}, `}${pp(m.residual)})`).join("; ") +
        "."
      : "";
    const deps = a.prereqs.filter((l) => l.from === s.section).map((l) => l.to);
    const depText = deps.length
      ? t(
          ` Раздел — фундамент для ${deps.map(q).join(", ")}: пробелы лучше закрыть до перехода к ${deps.length > 1 ? "ним" : "нему"}.`,
          ` Бөлім ${deps.map(q).join(", ")} үшін негіз: олқылықтарды келесі бөлімге өтпей тұрып жою керек.`,
        )
      : "";
    if (st?.systemic) {
      out.push({
        tone: "risk",
        title: t(`${q(s.section)}: трудный везде, а здесь ещё ниже`, `${q(s.section)}: барлық жерде қиын, ал мұнда одан да төмен`),
        text:
          t(
            `Раздел проседает по всей выборке, а в школе результат ещё на ${ppAbs(s.residual)} ниже ожидаемого для такого состава учеников (${Math.round(
              s.mean,
            )}% при ожидаемых ${Math.round(s.expected)}%). Нужны и системные меры, и разбор раздела с учителем.`,
            `Бөлім барлық іріктеме бойынша төмен, ал мектепте нәтиже мұндай оқушылар құрамы үшін күтілгеннен тағы ${ppAbs(s.residual)} төмен (${Math.round(
              s.mean,
            )}%, күтілгені ${Math.round(s.expected)}%). Жүйелі шаралар да, бөлімді мұғаліммен талдау да қажет.`,
          ) +
          depText +
          mentorText,
      });
    } else {
      out.push({
        tone: "risk",
        title: t(`${q(s.section)}: ниже ожидаемого на ${ppAbs(s.residual)}`, `${q(s.section)}: күтілгеннен ${ppAbs(s.residual)} төмен`),
        text:
          t(
            `${Math.round(s.mean)}% при ожидаемых ${Math.round(
              s.expected,
            )}% для учеников с таким стартовым уровнем и учебником. В других школах раздел осваивается лучше, значит, вопрос в преподавании: взаимопосещение уроков, разбор заданий СОР с учителем.`,
            `${Math.round(s.mean)}%, ал осындай бастапқы деңгейі мен оқулығы бар оқушылар үшін күтілгені ${Math.round(
              s.expected,
            )}%. Басқа мектептерде бөлім жақсырақ меңгеріледі, демек, мәселе оқытуда: сабаққа өзара қатысу, БЖБ тапсырмаларын мұғаліммен талдау.`,
          ) +
          depText +
          mentorText,
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
        title: t(`${q(s.section)}: недодано ${h1(short)} ч`, `${q(s.section)}: ${h1(short)} сағат берілмеген`),
        text: t(
          `Фактически ${h1(s.hours)} ч при ${sec.planned} ч по плану. В этом разделе каждый час заметно влияет на результат (+1 ч ≈ +${h1(
            hp.perHour,
          )} ${u}), поэтому часы стоит вернуть${hp.delta > 0 ? `, а по плану перераспределения — даже добавить ${hp.delta} ч` : ""}.`,
          `Жоспар бойынша ${sec.planned} сағат, нақты ${h1(s.hours)} сағат. Бұл бөлімде әр сағат нәтижеге айтарлықтай әсер етеді (+1 сағат ≈ +${h1(
            hp.perHour,
          )} ${u}), сондықтан сағаттарды қайтару керек${hp.delta > 0 ? `, ал қайта бөлу жоспары бойынша тағы ${hp.delta} сағат қосу ұсынылады` : ""}.`,
        ),
      });
    }
  }

  // Учебник: слабая глава того учебника, по которому учится школа
  for (const l of a.textbooks.lags.filter((l) => p.textbooks.includes(l.textbook))) {
    out.push({
      tone: "info",
      title: t(`${q(l.textbook)}: слабая глава ${q(l.section)}`, `${q(l.textbook)}: ${q(l.section)} — әлсіз тарау`),
      text: t(
        `При равном составе учеников этот учебник даёт в разделе на ${ppAbs(l.diffVsBest)} меньше лучшего. Учителям школы нужны дополнительные материалы к этой главе.`,
        `Оқушылар құрамы бірдей болғанда бұл оқулық бөлімде ең жақсысынан ${ppAbs(l.diffVsBest)} аз береді. Мектеп мұғалімдеріне осы тарауға қосымша материалдар қажет.`,
      ),
    });
  }

  const above = p.sections.filter((s) => s.flag === "above").sort((x, y) => y.residual - x.residual);
  if (above.length) {
    out.push({
      tone: "good",
      title: t(`Сильная сторона: ${above.map((s) => q(s.section)).join(", ")}`, `Күшті жағы: ${above.map((s) => q(s.section)).join(", ")}`),
      text: t(
        `Результат выше ожидаемого (${above.map((s) => `${q(s.section)} ${pp(s.residual)}`).join(", ")}). Опыт школы стоит тиражировать: открытый урок или семинар для учителей района.`,
        `Нәтиже күтілгеннен жоғары (${above.map((s) => `${q(s.section)} ${pp(s.residual)}`).join(", ")}). Мектеп тәжірибесін тарату керек: аудан мұғалімдеріне ашық сабақ немесе семинар.`,
      ),
    });
  }

  if (out.length === 0) {
    out.push({
      tone: "good",
      title: t("Существенных отклонений нет", "Елеулі ауытқулар жоқ"),
      text: t(
        "По всем разделам результат школы в пределах ожидаемого для её состава учеников и учебника.",
        "Барлық бөлім бойынша мектеп нәтижесі оқушылар құрамы мен оқулығы үшін күтілген шекте.",
      ),
    });
  }
  return out;
}
