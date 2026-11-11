// Готовые вопросы ассистента: ответы считаются прямо из анализа, без ИИ и без интернета.
import { Analysis } from "./analytics";
import { Dynamics, dynamicsHighlights } from "./dynamics";
import { makeFmt } from "./format";
import { Lang, tr } from "./i18n";

export type TabId = "overview" | "sections" | "schools" | "textbooks" | "hours" | "dynamics" | "report";
export type QuestionId = "hardest" | "textbook" | "hours" | "schools" | "first" | "dynamics" | "trust";

export interface Answer {
  text: string;
  tab?: TabId;
  school?: string;
  actionLabel?: string;
}

export const QUESTIONS: { id: QuestionId; ru: string; kk: string }[] = [
  { id: "hardest", ru: "Какой раздел самый трудный и почему?", kk: "Қай бөлім ең қиын және неге?" },
  { id: "schools", ru: "Каким школам нужна помощь?", kk: "Қай мектептерге көмек керек?" },
  { id: "textbook", ru: "Какой учебник лучше?", kk: "Қай оқулық жақсырақ?" },
  { id: "hours", ru: "Куда перенести учебные часы?", kk: "Оқу сағаттарын қайда ауыстыру керек?" },
  { id: "first", ru: "Что делать в первую очередь?", kk: "Алдымен не істеу керек?" },
  { id: "dynamics", ru: "Сработали ли изменения?", kk: "Өзгерістер нәтиже берді ме?" },
  { id: "trust", ru: "Можно ли доверять этим выводам?", kk: "Бұл қорытындыларға сенуге бола ма?" },
];

const q = (s: string) => `«${s}»`;

export function answer(
  id: QuestionId,
  a: Analysis,
  lang: Lang,
  validation?: { ok: number; total: number },
  dyn?: Dynamics | null,
): Answer {
  const t = (ru: string, kk: string) => tr(lang, ru, kk);
  const { pct, share, pp, nSchools } = makeFmt(lang);
  const open = (ru: string, kk: string) => t(`Открыть «${ru}»`, `«${kk}» ашу`);

  if (id === "dynamics") {
    if (!dyn)
      return {
        text: t(
          "В данных один учебный год, поэтому сравнить пока не с чем. Загрузите результаты СОР за два года в одном файле со столбцом «учебный_год» (например, 2024–2025 и 2025–2026) — OquLens покажет, что изменилось и сработали ли перенос часов или смена учебника.",
          "Деректерде бір оқу жылы ғана бар, сондықтан салыстыратын ештеңе жоқ. Екі жылдың БЖБ нәтижелерін «оқу_жылы» бағанымен бір файлда жүктеңіз (мысалы, 2024–2025 және 2025–2026) — OquLens не өзгергенін және сағатты ауыстыру не оқулықты ауыстыру нәтиже бергенін көрсетеді.",
        ),
        tab: "dynamics",
        actionLabel: open("Динамика по годам", "Жылдар динамикасы"),
      };
    const ch = dyn.overall.change;
    const hs = dynamicsHighlights(dyn, (n) => a.hours.sections.find((h) => h.name === n)?.perHour);
    const lines: string[] = [];
    for (const h of hs.filter((x) => x.verdict === "confirmed" || x.verdict === "weaker" || x.verdict === "not_confirmed")) {
      const s = h.section;
      const fc = h.forecast !== undefined ? pp(h.forecast) : "—";
      if (h.verdict === "confirmed" && s.slope)
        lines.push(t(`**${q(s.name)}**: связь с дополнительным часом оценивается в ${pp(s.slope.est)} (оценка модели ${fc}); необходима независимая проверка.`, `**${q(s.name)}**: қосымша сағатпен байланыс ${pp(s.slope.est)} (модель бағасы ${fc}); тәуелсіз тексеру қажет.`));
      else if (h.verdict === "weaker" && s.slope)
        lines.push(t(`**${q(s.name)}**: оценка отличается от прогноза (${pp(s.slope.est)} против ${fc}).`, `**${q(s.name)}**: баға болжамнан өзгеше (${pp(s.slope.est)}, болжам ${fc}).`));
      else lines.push(t(`**${q(s.name)}**: ожидаемый эффект часов (${fc}) не подтвердился.`, `**${q(s.name)}**: күтілген сағат әсері (${fc}) расталмады.`));
    }
    const low = hs.filter((x) => x.verdict === "low_return").map((x) => q(x.section.name));
    if (low.length)
      lines.push(t(`${low.join(", ")}: недостаточно оснований заключать, что сокращение часов безопасно.`, `${low.join(", ")}: сағатты қысқарту қауіпсіз деген қорытындыға дерек жеткіліксіз.`));
    const best = hs.find((x) => x.section.did?.significant && x.section.added && x.section.same)?.section;
    if (best?.did && best.added && best.same)
      lines.push(
        t(
          `Школы, добавившие 2+ часа на ${q(best.name)} (${best.added.n}): результат ${pp(best.added.delta)}; остальные (${best.same.n}): ${pp(best.same.delta)}.`,
          `${q(best.name)} бөліміне 2+ сағат қосқан мектептер (${best.added.n}): нәтиже ${pp(best.added.delta)}; қалғандары (${best.same.n}): ${pp(best.same.delta)}.`,
        ),
      );
    const up = dyn.schools.filter((s) => s.flag === "up").slice(0, 3).map((s) => s.school);
    const down = dyn.schools.filter((s) => s.flag === "down").reverse().slice(0, 3).map((s) => s.school);
    if (up.length || down.length)
      lines.push(
        t(
          `Сверх общей динамики выросли: ${up.join(", ") || "—"}; просели: ${down.join(", ") || "—"}.`,
          `Жалпы динамикадан тыс өскендер: ${up.join(", ") || "—"}; төмендегендер: ${down.join(", ") || "—"}.`,
        ),
      );
    return {
      text:
        t(
          `${dyn.prev} → ${dyn.cur}: при равном стартовом уровне средний результат изменился на **${pp(ch.est)}**${ch.significant ? "" : " (в пределах случайного разброса)"}.`,
          `${dyn.prev} → ${dyn.cur}: тең бастапқы деңгейде орташа нәтиже **${pp(ch.est)}** өзгерді${ch.significant ? "" : " (кездейсоқ ауытқу шегінде)"}.`,
        ) +
        "\n" +
        lines.map((l) => `- ${l}`).join("\n"),
      tab: "dynamics",
      actionLabel: open("Динамика по годам", "Жылдар динамикасы"),
    };
  }

  if (id === "hardest") {
    const s = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
    if (!s) return { text: t("Нет данных по разделам.", "Бөлімдер бойынша дерек жоқ.") };
    let text = t(
      `Самый трудный раздел — **${q(s.name)}**: средний результат ${pct(s.mean)}, у ${share(s.lowShare)} учащихся ниже 40%.`,
      `Ең қиын бөлім — **${q(s.name)}**: орташа нәтиже ${pct(s.mean)}, оқушылардың ${share(s.lowShare)}-ы 40%-дан төмен.`,
    );
    if (s.systemic)
      text += t(
        " Он проседает во всех школах, значит, проблема системная: программа, учебник или часы, а не отдельные учителя.",
        " Ол барлық мектепте төмен, демек, мәселе жүйелі: бағдарлама, оқулық немесе сағаттар, жекелеген мұғалімдер емес.",
      );
    else if (s.uneven)
      text += t(" Результат сильно зависит от школы — это вопрос преподавания.", " Нәтиже мектепке қатты тәуелді — бұл оқыту мәселесі.");
    const link = a.prereqs.filter((l) => l.to === s.name)[0];
    if (link && Number.isFinite(link.failIfWeak))
      text += t(
        `\n\nГлавная причина — пробелы в **${q(link.from)}**: среди не освоивших этот раздел ${share(link.failIfWeak)} провалили ${q(s.name)}, среди освоивших — ${share(
          link.failIfStrong,
        )}. Перед ${q(s.name)} стоит провести срез и 1–2 урока повторения.`,
        `\n\nНегізгі себеп — **${q(link.from)}** бөліміндегі олқылықтар: оны меңгермегендердің ${share(link.failIfWeak)}-ы ${q(s.name)} бөлімін орындай алмады, меңгергендердің арасында — ${share(
          link.failIfStrong,
        )}. ${q(s.name)} алдында қима және 1–2 қайталау сабағын өткізу керек.`,
      );
    return { text, tab: "sections", actionLabel: open("Трудные разделы", "Қиын бөлімдер") };
  }

  if (id === "textbook") {
    const tb = a.textbooks;
    if (!tb.ok || !tb.best)
      return {
        text: t(
          "Для сравнения учебников не хватает данных: нужно минимум два учебника, по каждому — не меньше 3 школ.",
          "Оқулықтарды салыстыруға дерек жеткіліксіз: кемінде екі оқулық, әрқайсысы бойынша 3 мектептен кем емес керек.",
        ),
      };
    const best = tb.rows.find((r) => r.name === tb.best)!;
    const naive = tb.naiveRank[0];
    let text = t(
      `С поправкой на состав учеников лучший результат у **${q(tb.best)}** (${pct(best.adjusted.mean)}).`,
      `Оқушылар құрамын ескергенде ең жақсы нәтиже — **${q(tb.best)}** (${pct(best.adjusted.mean)}).`,
    );
    if (naive && naive !== tb.best)
      text += t(
        ` По сырым баллам лидирует ${q(naive)}, но им чаще пользуются сильные городские школы — поэтому сырой рейтинг обманывает.`,
        ` Шикі балл бойынша ${q(naive)} алда, бірақ оны күшті қалалық мектептер жиі пайдаланады — сондықтан шикі рейтинг адастырады.`,
      );
    text += tb.bestSignificant
      ? t(` Отрыв от второго места ${pp(tb.bestMargin)} — различие надёжное.`, ` Екінші орыннан айырмасы ${pp(tb.bestMargin)} — айырма сенімді.`)
      : t(
          ` Отрыв ${pp(tb.bestMargin)} в пределах погрешности: менять учебник только из-за этого не стоит.`,
          ` ${pp(tb.bestMargin)} айырма қателік шегінде: тек осы себеппен оқулықты ауыстырудың қажеті жоқ.`,
        );
    const lag = tb.lags[0];
    if (lag)
      text += t(
        `\n\nСлабая глава: **${q(lag.textbook)}** в разделе ${q(lag.section)} отстаёт на ${pp(lag.diffVsBest).replace(/^−/, "")}. Стоит проверить задания и дополнительные материалы к этой главе.`,
        `\n\nӘлсіз тарау: **${q(lag.textbook)}** ${q(lag.section)} бөлімінде ${pp(lag.diffVsBest).replace(/^−/, "")} артта қалады. Осы тарауға қосымша материалдар жеткілікті.`,
      );
    return { text, tab: "textbooks", actionLabel: open("Учебники", "Оқулықтар") };
  }

  if (id === "hours") {
    const h = a.hours;
    if (!h.ok || h.movedHours === 0)
      return {
        text: h.ok
          ? t("Перенос часов не даёт надёжного выигрыша — текущее распределение можно оставить.", "Сағаттарды ауыстыру сенімді ұтыс бермейді — қазіргі бөлуді қалдыруға болады.")
          : t(
              "Нет данных о фактических часах по классам — рекомендации по часам недоступны.",
              "Сыныптар бойынша нақты сағаттар туралы дерек жоқ — сағат бойынша ұсыныстар қолжетімсіз.",
            ),
        tab: "hours",
      };
    const lines = h.sections
      .filter((s) => s.delta !== 0)
      .sort((x, y) => y.delta - x.delta)
      .map((s) => `- ${q(s.name)}: ${s.planned} → ${s.recommended} ${t("ч", "сағ")} (${s.delta > 0 ? "+" : "−"}${Math.abs(s.delta)})`);
    const text =
      t(
        `Рекомендуется перенести **${h.movedHours} ч** из ${h.totalPlanned}, общий объём не меняется:`,
        `${h.totalPlanned} сағаттың **${h.movedHours} сағатын** ауыстыру ұсынылады, жалпы көлем өзгермейді:`,
      ) +
      "\n" +
      lines.join("\n") +
      "\n\n" +
      t(
        `Ожидаемый эффект: ${pp(h.meanAfter - h.meanBefore)} к среднему результату (по консервативной оценке ${pp(
          h.meanAfterConservative - h.meanBefore,
        )}), доля результатов ниже 40%: ${share(h.lowBefore)} → ${share(h.lowAfter)}.`,
        `Күтілетін әсер: орташа нәтижеге ${pp(h.meanAfter - h.meanBefore)} (сақ бағалау бойынша ${pp(
          h.meanAfterConservative - h.meanBefore,
        )}), 40%-дан төмен нәтижелер үлесі: ${share(h.lowBefore)} → ${share(h.lowAfter)}.`,
      );
    return { text, tab: "hours", actionLabel: open("Учебные часы", "Оқу сағаттары") };
  }

  if (id === "schools") {
    const below = a.schools.filter((p) => p.vaFlag === "below").reverse();
    const above = a.schools.filter((p) => p.vaFlag === "above");
    if (!below.length)
      return {
        text: t(
          "Школ с результатом заметно ниже ожидаемого для их учеников не найдено.",
          "Оқушылары үшін күтілгеннен айтарлықтай төмен нәтижелі мектептер табылмады.",
        ),
        tab: "schools",
      };
    const lines = below.slice(0, 3).map((p) => {
      const secs = p.sections.filter((s) => s.flag === "below").map((s) => q(s.section));
      return `- **${p.school}** (${p.district}): ${pp(p.valueAdded)}${secs.length ? t(`; проседают ${secs.join(", ")}`, `; төмен бөлімдер: ${secs.join(", ")}`) : ""}`;
    });
    const worst = below[0];
    const worstSec = [...worst.sections].filter((s) => s.flag === "below").sort((x, y) => x.residual - y.residual)[0];
    const mentors = worstSec ? (worst.mentors[worstSec.section] ?? []) : [];
    let text =
      t(
        `С учётом состава учеников ниже ожидаемого ${nSchools(below.length)}, выше — ${nSchools(above.length)}. Больше всего помощь нужна:`,
        `Оқушылар құрамын ескергенде күтілгеннен төмен — ${nSchools(below.length)}, жоғары — ${nSchools(above.length)}. Көмек ең алдымен қажет:`,
      ) +
      "\n" +
      lines.join("\n");
    if (worstSec && mentors.length)
      text += t(
        `\n\nДля ${worst.school} по разделу ${q(worstSec.section)} наставниками могут стать: ${mentors.map((m) => m.school).join(", ")} — там этот раздел идёт лучше ожидаемого.`,
        `\n\n${worst.school} үшін ${q(worstSec.section)} бөлімі бойынша тәлімгер мектептер: ${mentors.map((m) => m.school).join(", ")} — онда бұл бөлім күтілгеннен жақсы.`,
      );
    return { text, tab: "schools", school: worst.school, actionLabel: t(`Открыть карточку: ${worst.school}`, `Карточканы ашу: ${worst.school}`) };
  }

  if (id === "first") {
    const items: string[] = [];
    const root = a.prereqs.find((l) => a.sections.find((s) => s.name === l.to)?.status === "hard");
    if (root)
      items.push(
        t(
          `Перед ${q(root.to)} провести срез по ${q(root.from)} и 1–2 урока повторения для учащихся ниже 40%.`,
          `${q(root.to)} алдында ${q(root.from)} бойынша қима өткізіп, 40%-дан төмен оқушыларға 1–2 қайталау сабағын беру.`,
        ),
      );
    const lag = a.textbooks.lags[0];
    if (lag)
      items.push(
        t(
          `Школам с ${q(lag.textbook)} дать дополнительные материалы к разделу ${q(lag.section)}.`,
          `${q(lag.textbook)} бойынша оқитын мектептерге ${q(lag.section)} бөліміне қосымша материалдар беру.`,
        ),
      );
    const broad = a.schools.filter((p) => p.vaFlag === "below" && p.sections.filter((s) => s.flag === "below").length >= 3).reverse();
    if (broad.length)
      items.push(
        t(
          `Закрепить методиста и наставников за школами с отставанием по большинству разделов: ${broad
            .slice(0, 3)
            .map((p) => p.school)
            .join(", ")}.`,
          `Бөлімдердің көпшілігі бойынша артта қалған мектептерге әдіскер мен тәлімгер бекіту: ${broad
            .slice(0, 3)
            .map((p) => p.school)
            .join(", ")}.`,
        ),
      );
    if (a.hours.ok && a.hours.movedHours > 0)
      items.push(
        t(
          `Апробировать перенос ${a.hours.movedHours} ч в 5–10 школах и сравнить следующий СОР с остальными.`,
          `${a.hours.movedHours} сағатты ауыстыруды 5–10 мектепте сынап, келесі БЖБ-ны қалғандарымен салыстыру.`,
        ),
      );
    if (!items.length) items.push(t("Существенных проблем не найдено — повторите анализ после следующего СОР.", "Елеулі мәселелер табылмады — келесі БЖБ-дан кейін талдауды қайталаңыз."));
    return {
      text: t("План на ближайшую четверть:", "Жақын тоқсанға арналған жоспар:") + "\n" + items.map((x, i) => `${i + 1}. ${x}`).join("\n"),
      tab: "report",
      actionLabel: open("Методическая записка", "Әдістемелік жазба"),
    };
  }

  // trust
  const lines = [
    t(
      "учебники и школы сравниваются при равных условиях: стартовый уровень учеников, город/село, язык обучения;",
      "оқулықтар мен мектептер тең жағдайда салыстырылады: оқушылардың бастапқы деңгейі, қала/ауыл, оқыту тілі;",
    ),
    t(
      "у каждой цифры есть 95% интервал, а оценки небольших школ осторожно сдвигаются к среднему;",
      "әр санның 95% аралығы бар, ал шағын мектептердің бағалары ортаға қарай сақтықпен жылжытылады;",
    ),
    t(
      "час переносится, только если выигрыш больше потерь даже в пессимистичном сценарии;",
      "сағат пессимистік сценарийде де ұтыс шығыннан көп болса ғана ауыстырылады;",
    ),
  ];
  if (validation)
    lines.push(
      t(
        `на демо-данных с известным ответом платформа нашла ${validation.ok} из ${validation.total} заложенных закономерностей (блок «Проверка метода» на вкладке «Обзор»).`,
        `жауабы белгілі демо-деректерде платформа ${validation.total} заңдылықтың ${validation.ok}-ін тапты («Шолу» қойындысындағы «Әдісті тексеру» блогы).`,
      ),
    );
  return {
    text: t("Выводам можно доверять, потому что:", "Қорытындыларға сенуге болады, себебі:") + "\n" + lines.map((l) => `- ${l}`).join("\n"),
    tab: "overview",
    actionLabel: open("Обзор", "Шолу"),
  };
}
