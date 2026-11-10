import { ArrowRight, BookOpen, Clock, Download, GitBranch, Layers, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { COLUMNS } from "@/lib/csv";
import { Logo } from "./App";

export default function Welcome({
  onDemo,
  onUpload,
  onTemplate,
  onTemplateCsv,
}: {
  onDemo: () => void;
  onUpload: () => void;
  onTemplate: () => void;
  onTemplateCsv: () => void;
}) {
  const features = [
    {
      icon: <Layers size={20} />,
      title: "Трудные разделы",
      text: "Где проседают ученики и почему: системная проблема программы или конкретных школ.",
    },
    {
      icon: <GitBranch size={20} />,
      title: "Корень проблемы",
      text: "Находит раздел-пререквизит, из-за которого «сыпется» следующая тема.",
    },
    {
      icon: <BookOpen size={20} />,
      title: "Честное сравнение учебников",
      text: "С поправкой на стартовый уровень учеников — сильные школы не искажают рейтинг.",
    },
    {
      icon: <Clock size={20} />,
      title: "Перераспределение часов",
      text: "Сколько часов перенести и куда, с прогнозом эффекта и симулятором «что если».",
    },
  ];
  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-[1120px] px-6 pt-8 pb-16">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="text-[12.5px] text-slate-400">EdTech Hackathon · Zhambyl Hub · Кейс 1</span>
        </div>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-emerald-300">
              <Sparkles size={13} /> Для методистов отделов и управлений образования
            </span>
            <h1 className="mt-5 text-[40px] leading-[1.1] font-extrabold tracking-tight md:text-[48px]">
              Учебники и часы — по результатам СОР, <span className="text-emerald-400">а не по мнениям</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-slate-300">
              Загрузите результаты суммативного оценивания за разделы. OquLens найдёт трудные темы, честно сравнит учебники и
              предложит, как перераспределить учебные часы, а затем соберёт методическую записку.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onDemo}
                className="group inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-[14.5px] font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-brand-600"
              >
                Открыть демо: алгебра, 7 класс, Жамбылская область
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={onUpload}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-[14.5px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <Upload size={17} /> Загрузить Excel или CSV
              </button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-400">
              <ShieldCheck size={14} /> Данные учеников обрабатываются прямо в браузере и не отправляются на сервер.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">{f.icon}</div>
                <h3 className="mt-3 text-[15px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold">Формат данных</h2>
              <p className="mt-1 text-[13px] text-slate-400">
                Одна строка — результат одного ученика за один СОР. Подойдёт выгрузка из электронного журнала: файл Excel (.xlsx) или CSV.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onTemplate}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/15"
              >
                <Download size={15} /> Шаблон Excel
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
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11.5px] text-emerald-200">{c.ru}</code>
                <span className="text-slate-400">
                  {c.hint}
                  {c.required && <span className="text-amber-300"> *</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-slate-500">
            * обязательные столбцы. Заголовки можно писать и по-английски: school, class_id, score… После загрузки платформа покажет, всё ли в
            файле в порядке.
          </p>
        </div>
      </div>
    </div>
  );
}
