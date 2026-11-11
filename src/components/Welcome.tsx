"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  Download,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  School,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { analyze } from "@/lib/analytics";
import { COLUMNS } from "@/lib/csv";
import { generateDemo } from "@/lib/generator";
import { heatColor, makeFmt } from "@/lib/format";
import { Logo } from "./App";
import { useLang, useT } from "./lang";

interface Preview {
  title: string;
  schools: number;
  hardest: { name: string; mean: number; systemic: boolean };
  root?: { from: string; weak: number; strong: number };
  best?: string;
  hours?: { moved: number; total: number; gain: number };
  sections: { name: string; mean: number }[];
}

export default function Welcome({
  onDemo,
  onTour,
  onUpload,
  onTemplate,
  onTemplateCsv,
  langSwitch,
}: {
  onDemo: () => void;
  onTour: () => void;
  onUpload: () => void;
  onTemplate: () => void;
  onTemplateCsv: () => void;
  langSwitch: ReactNode;
}) {
  const lang = useLang();
  const t = useT();
  const [preview, setPreview] = useState<Preview | null>(null);

  // Живое превью на демо-данных: считается после первой отрисовки, чтобы не задерживать страницу
  useEffect(() => {
    setPreview(null);
    const id = setTimeout(() => {
      const ds = generateDemo(2026, lang);
      const a = analyze(ds.rows);
      if (!a) return;
      const hardest = [...a.sections].sort((x, y) => x.mean - y.mean)[0];
      const root = a.prereqs.find((l) => l.to === hardest.name);
      setPreview({
        title: `${ds.subject}, ${ds.grade}`,
        schools: a.meta.nSchools,
        hardest: { name: hardest.name, mean: hardest.mean, systemic: hardest.systemic },
        root: root ? { from: root.from, weak: root.failIfWeak, strong: root.failIfStrong } : undefined,
        best: a.textbooks.best ?? undefined,
        hours: a.hours.ok ? { moved: a.hours.movedHours, total: a.hours.totalPlanned, gain: a.hours.meanAfter - a.hours.meanBefore } : undefined,
        sections: a.sections.map((s) => ({ name: s.name, mean: s.mean })),
      });
    }, 60);
    return () => clearTimeout(id);
  }, [lang]);

  const features = [
    {
      icon: <Layers size={20} />,
      title: t("Трудные разделы", "Қиын бөлімдер"),
      text: t("Где результаты ниже и как они различаются между школами.", "Оқушылар қай жерде қиналады және неге: бағдарламаның жүйелі мәселесі ме, әлде нақты мектептердікі ме."),
    },
    {
      icon: <GitBranch size={20} />,
      title: t("Возможная связь тем", "Тақырыптардың ықтимал байланысы"),
      text: t("Показывает связь между результатами по ранее изученной и следующей теме.", "Алдыңғы және келесі тақырып нәтижелерінің байланысын көрсетеді."),
    },
    {
      icon: <School size={20} />,
      title: t("Школы и наставники", "Мектептер және тәлімгерлер"),
      text: t("Каждая школа — относительно ожидаемого для её учеников. Кому помочь и у кого учиться.", "Әр мектеп — оқушылары үшін күтілгенге қатысты. Кімге көмектесу және кімнен үйрену керек."),
    },
    {
      icon: <BookOpen size={20} />,
      title: t("Учебники при равных условиях", "Тең жағдайдағы оқулықтар"),
      text: t("С поправкой на стартовый уровень учеников и слабые главы конкретного учебника.", "Оқушылардың бастапқы деңгейі ескеріледі, нақты оқулықтың әлсіз тараулары табылады."),
    },
    {
      icon: <Clock size={20} />,
      title: t("Перенос часов", "Сағаттарды ауыстыру"),
      text: t("Сколько часов перенести и куда, с прогнозом эффекта и симулятором «что если».", "Қанша сағатты қайда ауыстыру керек — әсер болжамы және «егер...» симуляторымен."),
    },
    {
      icon: <Sparkles size={20} />,
      title: t("ИИ-ассистент и записка", "ИИ-көмекші және жазба"),
      text: t("Вопросы к данным и методическая записка на русском или казахском — в один клик.", "Деректерге сұрақтар және қазақ не орыс тіліндегі әдістемелік жазба — бір басумен."),
    },
  ];

  const steps = [
    {
      icon: <FileSpreadsheet size={18} />,
      title: t("Загрузите результаты СОР", "БЖБ нәтижелерін жүктеңіз"),
      text: t("Excel или CSV из электронного журнала. Платформа сама проверит файл.", "Электрондық журналдан Excel немесе CSV. Платформа файлды өзі тексереді."),
    },
    {
      icon: <Compass size={18} />,
      title: t("Получите диагноз", "Диагноз алыңыз"),
      text: t("Трудные разделы, связи между темами, школы, учебники и часы — за секунды.", "Қиын бөлімдер, тақырыптар байланысы, мектептер, оқулықтар мен сағаттар — бірнеше секундта."),
    },
    {
      icon: <FileText size={18} />,
      title: t("Действуйте по плану", "Жоспар бойынша әрекет етіңіз"),
      text: t("Методическая записка и план на четверть — готовы к отправке в отдел.", "Әдістемелік жазба мен тоқсандық жоспар бөлімге жіберуге дайын."),
    },
  ];

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(16,185,129,0.18),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1160px] px-5 pt-6 pb-16 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-[12.5px] text-slate-400 sm:inline">EdTech Hackathon · Zhambyl Hub · {t("Кейс 1", "1-кейс")}</span>
            {langSwitch}
          </div>
        </div>

        <div className="mt-12 grid items-center gap-10 lg:mt-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-emerald-300">
              <Sparkles size={13} /> {t("Для методистов отделов и управлений образования", "Білім бөлімдері мен басқармаларының әдіскерлеріне")}
            </span>
            <h1 className="mt-5 text-[34px] leading-[1.1] font-extrabold tracking-tight sm:text-[44px] md:text-[50px]">
              {t("Учебники и часы — по результатам СОР, ", "Оқулықтар мен сағаттар — пікір бойынша емес, ")}
              <span className="text-emerald-400">{t("а не по мнениям", "БЖБ нәтижелері бойынша")}</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-slate-300">
              {t(
                "Загрузите результаты суммативного оценивания за разделы. OquLens найдёт трудные темы и возможные связи между ними, покажет, каким школам нужна помощь, честно сравнит учебники, предложит перенос часов и соберёт методическую записку.",
                "Бөлім бойынша жиынтық бағалау нәтижелерін жүктеңіз. OquLens қиын тақырыптар мен олардың ықтимал байланыстарын көрсетеді, қай мектептерге көмек керегін көрсетеді, оқулықтарды әділ салыстырады, сағаттарды ауыстыруды ұсынады және әдістемелік жазба құрастырады.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onDemo}
                className="group inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-[14.5px] font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-brand-600"
              >
                {t("Открыть демо: алгебра, 7 класс", "Демоны ашу: алгебра, 7-сынып")}
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={onTour}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[14.5px] font-bold text-ink transition hover:bg-emerald-50"
              >
                <Compass size={17} /> {t("Экскурсия для жюри · 2 мин", "Қазылар үшін саяхат · 2 мин")}
              </button>
              <button
                onClick={onUpload}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-[14.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <Upload size={17} /> {t("Загрузить Excel или CSV", "Excel немесе CSV жүктеу")}
              </button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-400">
              <ShieldCheck size={14} className="shrink-0" />
              {t("Данные учеников обрабатываются прямо в браузере и не отправляются на сервер.", "Оқушылар деректері тікелей браузерде өңделеді және серверге жіберілмейді.")}
            </p>
          </div>

          <PreviewCard preview={preview} />
        </div>

        <div className="mt-16 grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="flex gap-3 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[14px] font-extrabold text-emerald-300">
                {i + 1}
              </span>
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-bold">
                  {s.title} <span className="text-emerald-300/70">{s.icon}</span>
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((ft) => (
            <div key={ft.title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">{ft.icon}</div>
              <h3 className="mt-3 text-[15px] font-bold">{ft.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{ft.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold">{t("Формат данных", "Деректер пішімі")}</h2>
              <p className="mt-1 text-[13px] text-slate-400">
                {t(
                  "Одна строка — результат одного ученика за один СОР. Подойдёт выгрузка из электронного журнала: файл Excel (.xlsx) или CSV.",
                  "Бір жол — бір оқушының бір БЖБ бойынша нәтижесі. Электрондық журналдан алынған Excel (.xlsx) немесе CSV файлы жарайды.",
                )}
              </p>
              <p className="mt-1.5 text-[13px] text-slate-400">
                {t(
                  "Или как в журнале: строки — ученики, столбцы — «СОР 1 (макс 15)», «СОР 2 (макс 18)»… ФИО заменяются кодами прямо в браузере. Можно выбрать или перетащить сразу несколько файлов — по классу или по школе в каждом.",
                  "Немесе журналдағыдай: жолдар — оқушылар, бағандар — «БЖБ 1 (макс 15)», «БЖБ 2 (макс 18)»… Аты-жөндер браузердің өзінде кодтармен ауыстырылады. Бірден бірнеше файлды таңдауға немесе сүйреп әкелуге болады — әрқайсысында бір сынып не бір мектеп.",
                )}{" "}
                <a href="/demo/oqulens_journal_example.xlsx" download className="font-semibold text-emerald-300 hover:underline">
                  {t("Пример журнала (Excel)", "Журнал үлгісі (Excel)")}
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onTemplate}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/15"
              >
                <Download size={15} /> {t("Шаблон Excel", "Excel үлгісі")}
              </button>
              <button
                onClick={onTemplateCsv}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-slate-300 ring-1 ring-white/15 hover:bg-white/10"
              >
                CSV
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
            {COLUMNS.map((c) => (
              <div key={c.csv} className="flex items-baseline gap-2">
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11.5px] text-emerald-200">{lang === "kk" ? c.kk : c.ru}</code>
                <span className="text-slate-400">
                  {lang === "kk" ? c.hintKk : c.hint}
                  {c.required && <span className="text-amber-300"> *</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-slate-500">
            {t(
              "* обязательные столбцы. Заголовки можно писать по-русски, по-казахски или по-английски (school, class_id, score…). После загрузки платформа покажет, всё ли в файле в порядке.",
              "* міндетті бағандар. Тақырыптарды қазақша, орысша немесе ағылшынша (school, class_id, score…) жазуға болады. Жүктегеннен кейін платформа файлдың дұрыстығын көрсетеді.",
            )}
          </p>
        </div>

        <p className="mt-10 text-center text-[12px] text-slate-500">
          {t("Команда «lavash» · EdTech Hackathon by Zhambyl Hub · 2026", "«lavash» командасы · EdTech Hackathon by Zhambyl Hub · 2026")}
        </p>
      </div>
    </div>
  );
}

function PreviewCard({ preview }: { preview: Preview | null }) {
  const t = useT();
  const lang = useLang();
  const { pct, share, pp, nSchools } = makeFmt(lang);
  return (
    <div className="relative">
      <div className="absolute -inset-3 rounded-[28px] bg-emerald-400/10 blur-2xl" />
      <div className="relative rounded-3xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/40 ring-1 ring-white/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-wide text-brand uppercase">{t("Пример на демо-данных", "Демо-деректердегі мысал")}</div>
            <div className="mt-0.5 text-[15px] font-extrabold">{preview ? `${preview.title} · ${nSchools(preview.schools)}` : "…"}</div>
          </div>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">ДЕМО</span>
        </div>
        {!preview ? (
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-2.5">
              <Row
                color="bg-red-50 text-red-600"
                big={pct(preview.hardest.mean)}
                text={t(
                  `«${preview.hardest.name}»${preview.hardest.systemic ? " — системная проблема" : " — самый трудный раздел"}`,
                  `«${preview.hardest.name}»${preview.hardest.systemic ? " — жүйелі мәселе" : " — ең қиын бөлім"}`,
                )}
              />
              {preview.root && (
                <Row
                  color="bg-sky-50 text-sky-600"
                  big={`${share(preview.root.weak)} → ${share(preview.root.strong)}`}
                  text={t(`возможная связь с темой «${preview.root.from}»`, `ықтимал байланыс — «${preview.root.from}»`)}
                />
              )}
              {preview.best && (
                <Row color="bg-violet-50 text-violet-600" big="★" text={t(`«${preview.best}» — лучший при равных условиях`, `«${preview.best}» — тең жағдайда ең жақсы`)} />
              )}
              {preview.hours && (
                <Row
                  color="bg-emerald-50 text-emerald-700"
                  big={pp(preview.hours.gain)}
                  text={t(`перенос ${preview.hours.moved} ч из ${preview.hours.total}`, `${preview.hours.total} сағаттың ${preview.hours.moved}-ін ауыстыру`)}
                />
              )}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <div className="mb-2 text-[11px] font-semibold text-muted">{t("Средний результат по разделам", "Бөлімдер бойынша орташа нәтиже")}</div>
              <div className="space-y-1.5">
                {preview.sections.map((s) => (
                  <div key={s.name} className="grid grid-cols-[minmax(0,1fr)_120px_34px] items-center gap-2 text-[11.5px]">
                    <span className="truncate text-slate-600">{s.name}</span>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-full rounded-full" style={{ width: `${s.mean}%`, background: heatColor(s.mean) }} />
                    </div>
                    <span className="tabular text-right font-bold">{pct(s.mean)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ color, big, text }: { color: string; big: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
      <span className={`tabular min-w-[88px] rounded-lg px-2 py-1.5 text-center text-[15px] font-extrabold ${color}`}>{big}</span>
      <span className="text-[12.5px] leading-snug font-semibold text-slate-700">{text}</span>
    </div>
  );
}
