import { ReactNode } from "react";
import { Level } from "@/lib/types";
import { LEVEL_LABEL, LEVEL_ORDER } from "@/lib/analytics";
import { share } from "@/lib/format";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "gray", wrap = false, children }: { tone?: keyof typeof TONES; wrap?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${
        wrap ? "max-w-full whitespace-normal" : "whitespace-nowrap"
      } ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Kpi({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        {icon}
        {label}
      </div>
      <div className="tabular mt-2 text-[26px] font-extrabold leading-none text-slate-900">{value}</div>
      {sub && <div className="mt-1.5 text-[12.5px] text-muted">{sub}</div>}
    </div>
  );
}

const LEVEL_BG: Record<Level, string> = {
  low: "bg-lvl-low",
  mid: "bg-lvl-mid",
  good: "bg-lvl-good",
  high: "bg-lvl-high",
};

export function LevelBar({ levels, height = "h-3" }: { levels: Record<Level, number>; height?: string }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${height}`}>
      {LEVEL_ORDER.map((l) => (
        <div
          key={l}
          className={LEVEL_BG[l]}
          style={{ width: `${100 * levels[l]}%` }}
          title={`${LEVEL_LABEL[l]}: ${share(levels[l])}`}
        />
      ))}
    </div>
  );
}

export function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {LEVEL_ORDER.map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${LEVEL_BG[l]}`} />
          {LEVEL_LABEL[l]}
        </span>
      ))}
    </div>
  );
}

export function Note({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
      {icon && <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: "hard" | "watch" | "ok" }) {
  if (status === "hard") return <Badge tone="red">Трудный</Badge>;
  if (status === "watch") return <Badge tone="amber">Внимание</Badge>;
  return <Badge tone="green">Норма</Badge>;
}
