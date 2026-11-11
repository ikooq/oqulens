"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { Analysis } from "@/lib/analytics";
import { Dynamics, dynamicsHighlights } from "@/lib/dynamics";
import { makeFmt } from "@/lib/format";
import { useLang, useT } from "./lang";
import type { Tab } from "./App";

interface Step {
  tab: Tab;
  target: string;
  title: string;
  text: string;
  school?: string;
}

/** Пошаговая экскурсия по демо: переключает вкладки и подсвечивает главное. */
export default function Tour({
  a,
  dyn,
  hasTruth,
  onTab,
  onSchool,
  onAssistant,
  onClose,
}: {
  a: Analysis;
  dyn?: Dynamics | null;
  hasTruth: boolean;
  onTab: (t: Tab) => void;
  onSchool: (s: string) => void;
  onAssistant: () => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const t = useT();
  const { pct, share, pp, nSchools } = makeFmt(lang);
  const [i, setI] = useState(0);

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    out.push({
      tab: "overview",
      target: "insights",
      title: t("Главные выводы — на первом экране", "Негізгі қорытындылар — бірінші экранда"),
      text: t(
        `Методист загружает результаты СОР, и платформа сама формулирует выводы: ${a.insights.length} главных, от трудного раздела до плана часов. Каждый ведёт на подробную вкладку.`,
        `Әдіскер БЖБ нәтижелерін жүктейді, ал платформа қорытындыларды өзі тұжырымдайды: ${a.insights.length} негізгі қорытынды, қиын бөлімнен сағат жоспарына дейін. Әрқайсысы толық қойындыға апарады.`,
      ),
    });
    const hardest = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
    const uneven = a.sections.find((s) => s.uneven);
    if (hardest)
      out.push({
        tab: "sections",
        target: "diagnosis",
        title: t("Диагноз: программа или преподавание?", "Диагноз: бағдарлама ма, әлде оқыту ма?"),
        text:
          t(
            `«${hardest.name}» — ${pct(hardest.mean)}${hardest.systemic ? ", проседает во всех школах: это системная проблема." : "."}`,
            `«${hardest.name}» — ${pct(hardest.mean)}${hardest.systemic ? ", барлық мектепте төмен: бұл жүйелі мәселе." : "."}`,
          ) +
          (uneven
            ? t(` По теме «${uneven.name}» есть различия между школами — причины требуют проверки.`, ` «${uneven.name}» бойынша мектептер арасында айырмашылық бар — себептерін тексеру қажет.`)
            : ""),
      });
    const root = a.prereqs.filter((l) => l.to === hardest?.name)[0] ?? a.prereqs[0];
    if (root && Number.isFinite(root.failIfWeak))
      out.push({
        tab: "sections",
        target: "prereqs",
        title: t("Возможная связь тем", "Тақырыптардың ықтимал байланысы"),
        text: t(
          `Кто не освоил «${root.from}», в ${share(root.failIfWeak)} случаев проваливает «${root.to}». Среди освоивших — ${share(root.failIfStrong)}. Начинать нужно с повторения «${root.from}».`,
          `«${root.from}» бөлімін меңгермегендер «${root.to}» бөлімін ${share(root.failIfWeak)} жағдайда орындай алмайды. Меңгергендерде — ${share(root.failIfStrong)}. «${root.from}» бөлімін қайталаудан бастау керек.`,
        ),
      });
    const below = a.schools.filter((p) => p.vaFlag === "below");
    const above = a.schools.filter((p) => p.vaFlag === "above");
    if (a.schools.length > 2) {
      out.push({
        tab: "schools",
        target: "caterpillar",
        title: t("Школы — относительно ожидаемого", "Мектептер — күтілгенге қатысты"),
        text: t(
          `Каждая точка — школа. Её результат сравнивается с ожидаемым для таких же учеников, а не с сырым средним: ниже ожидаемого ${nSchools(below.length)}, выше — ${nSchools(above.length)}.`,
          `Әр нүкте — мектеп. Оның нәтижесі шикі ортамен емес, осындай оқушылар үшін күтілетін нәтижемен салыстырылады: күтілгеннен төмен — ${nSchools(below.length)}, жоғары — ${nSchools(above.length)}.`,
        ),
      });
      const worst = below[below.length - 1];
      if (worst)
        out.push({
          tab: "schools",
          school: worst.school,
          target: "school-actions",
          title: t(`Карточка школы: ${worst.school}`, `Мектеп карточкасы: ${worst.school}`),
          text: t(
            `${pp(worst.valueAdded)} к ожидаемому. Платформа говорит, что делать, и называет школы-наставники, у которых проседающий раздел идёт лучше всего.`,
            `Күтілгенге қатысты ${pp(worst.valueAdded)}. Платформа не істеу керегін айтады және төмен бөлім ең жақсы өтетін тәлімгер мектептерді атайды.`,
          ),
        });
    }
    const tb = a.textbooks;
    if (tb.ok && tb.best)
      out.push({
        tab: "textbooks",
        target: "tb-verdict",
        title: t("Учебники — при равных условиях", "Оқулықтар — тең жағдайда"),
        text:
          tb.naiveRank[0] !== tb.best
            ? t(
                `По сырым баллам лидирует «${tb.naiveRank[0]}», но с поправкой на состав учеников лучший — «${tb.best}». Сырой рейтинг обманывает.`,
                `Шикі балл бойынша «${tb.naiveRank[0]}» алда, бірақ оқушылар құрамын ескергенде ең жақсысы — «${tb.best}». Шикі рейтинг адастырады.`,
              )
            : t(`Лучший учебник при равных условиях — «${tb.best}».`, `Тең жағдайдағы ең жақсы оқулық — «${tb.best}».`),
      });
    if (a.hours.ok && a.hours.movedHours > 0)
      out.push({
        tab: "hours",
        target: "hours-plan",
        title: t("Часы — туда, где они работают", "Сағаттар — нәтиже беретін жерге"),
        text: t(
          `${a.hours.movedHours} ч из ${a.hours.totalPlanned} переносятся внутри утверждённого объёма: прогноз ${pp(a.hours.meanAfter - a.hours.meanBefore)} к среднему результату. Ниже — симулятор «что если».`,
          `${a.hours.totalPlanned} сағаттың ${a.hours.movedHours} сағаты бекітілген көлем ішінде ауыстырылады: болжам — орташа нәтижеге ${pp(a.hours.meanAfter - a.hours.meanBefore)}. Төменде — «егер...» симуляторы.`,
        ),
      });
    if (dyn) {
      const top = dynamicsHighlights(dyn, (n) => a.hours.sections.find((h) => h.name === n)?.perHour)[0];
      const s = top?.section;
      out.push({
        tab: "dynamics",
        target: "dyn-check",
        title: t("Сработало ли? Проверка год к году", "Нәтиже берді ме? Жылдан жылға тексеру"),
        text:
          top?.verdict === "confirmed" && s?.slope && top.forecast !== undefined
            ? t(
                `Загрузите два учебных года — и платформа проверит изменения. В демо часть школ перенесла часы: оценка связи часов с результатом по «${s.name}» — ${pp(s.slope.est)}, а оценка модели — ${pp(top.forecast)}. Оценки используют общие данные и требуют независимой проверки.`,
                `Екі оқу жылын жүктеңіз — платформа өзгерістерді тексереді. Демода кейбір мектептер сағатты ауыстырды: «${s.name}» бойынша байланыс бағасы ${pp(s.slope.est)}, модель бағасы ${pp(top.forecast)}. Бағалар ортақ деректерге негізделген, тәуелсіз тексеру қажет.`,
              )
            : t(
                `Сравнение ${dyn.prev} и ${dyn.cur}: что изменилось при равном стартовом уровне и в каких школах — заметный рост или спад.`,
                `${dyn.prev} және ${dyn.cur} салыстыру: тең бастапқы деңгейде не өзгерді және қай мектептерде айтарлықтай өсу не төмендеу бар.`,
              ),
      });
    }
    out.push({
      tab: "report",
      target: "report",
      title: t("Методическая записка — в один клик", "Әдістемелік жазба — бір басумен"),
      text: t(
        "Готовый документ для отдела образования на русском или казахском: выводы, школы, учебники, часы, план на четверть. PDF и печать — здесь же.",
        "Білім бөліміне арналған дайын құжат қазақ немесе орыс тілінде: қорытындылар, мектептер, оқулықтар, сағаттар, тоқсандық жоспар. PDF және басып шығару — осында.",
      ),
    });
    if (hasTruth)
      out.push({
        tab: "overview",
        target: "validation",
        title: t("Проверка метода", "Әдісті тексеру"),
        text: t(
          "В демо-данные заранее заложены закономерности. Платформа нашла их сама, не зная ответа, — сверка видна прямо здесь.",
          "Демо-деректерге заңдылықтар алдын ала салынған. Платформа оларды жауапты білмей-ақ өзі тапты — салыстыру осы жерде көрінеді.",
        ),
      });
    out.push({
      tab: "overview",
      target: "assistant",
      title: t("Спросите OquLens", "OquLens-тен сұраңыз"),
      text: t(
        "Ассистент отвечает на вопросы о результатах: готовые вопросы считаются прямо из данных, свои обрабатывает ИИ. В ИИ уходят только сводные цифры.",
        "Көмекші нәтижелер туралы сұрақтарға жауап береді: дайын сұрақтар деректерден есептеледі, өз сұрақтарыңызды ИИ өңдейді. ИИ-ге тек жиынтық сандар жіберіледі.",
      ),
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, dyn, hasTruth, lang]);

  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  useEffect(() => {
    if (step.school) onSchool(step.school);
    else onTab(step.tab);
    let el: HTMLElement | null = null;
    const timer = setTimeout(() => {
      el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) return;
      el.classList.add("tour-focus");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    return () => {
      clearTimeout(timer);
      el?.classList.remove("tour-focus");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step.target, step.tab, step.school]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  return (
    <>
    {/* Затемнение: подсвеченный блок (z-45) остаётся над ним */}
    <div className="pointer-events-none fixed inset-0 z-[44] bg-[#0c1a2b]/45 print:hidden" />
    <div
      className="fixed bottom-4 left-1/2 z-[60] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10 print:hidden"
      role="dialog"
      aria-label={t("Экскурсия по демо", "Демо бойынша саяхат")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-brand uppercase">
          <Compass size={14} /> {t("Экскурсия", "Саяхат")} · {i + 1} / {steps.length}
        </span>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t("Закрыть", "Жабу")}>
          <X size={17} />
        </button>
      </div>
      <h3 className="mt-2 text-[16px] font-extrabold text-slate-900">{step.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{step.text}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {steps.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-brand" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 && (
            <button
              onClick={() => setI(i - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> {t("Назад", "Артқа")}
            </button>
          )}
          <button
            onClick={() => {
              if (last) {
                onClose();
                onAssistant();
              } else setI(i + 1);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-600"
          >
            {last ? t("Открыть ассистента", "Көмекшіні ашу") : t("Далее", "Әрі қарай")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
