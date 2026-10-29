"use client";

import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import type { MarginStatus } from "@/lib/margin";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-stone-200 bg-white p-5 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-stone-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "good" | "warn" | "loss" }) {
  const toneClass = { default: "text-stone-900", good: "text-emerald-600", warn: "text-amber-600", loss: "text-rose-600" }[tone];
  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={cx("mt-1 text-xl font-bold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, "resize-y leading-relaxed", props.className)} />;
}

export function NumberInput({
  value,
  onValueChange,
  suffix,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onValueChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={cx(inputClass, "text-right tabular-nums", suffix && "pr-9")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
    </div>
  );
}

/**
 * 입력 중에는 로컬 상태만 바꾸고 Enter/포커스 해제 시에만 onCommit 한다.
 * 공급가처럼 변경 이력이 쌓이는 값을 타이핑 도중 저장하지 않기 위함.
 * 외부 값이 바뀌면 key로 리마운트해 동기화한다.
 */
interface CommitNumberProps {
  value: number | undefined;
  onCommit: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function CommitNumber(props: CommitNumberProps) {
  return <CommitNumberInner key={props.value ?? "empty"} {...props} />;
}

function CommitNumberInner({ value, onCommit, placeholder, className }: CommitNumberProps) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const commit = () => {
    const next = draft.trim() === "" ? null : Number(draft);
    if (next !== null && !Number.isFinite(next)) return setDraft(value === undefined ? "" : String(value));
    if (next !== (value ?? null)) onCommit(next);
  };
  return (
    <input
      type="number"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={cx("w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums hover:border-stone-200 focus:border-emerald-500 focus:bg-white focus:outline-none", className)}
    />
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700" aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variantClass = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
    ghost: "text-stone-600 hover:bg-stone-100",
    danger: "text-rose-600 hover:bg-rose-50",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={cx("rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40", variantClass, className)}
    />
  );
}

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant="ghost" onClick={copy} disabled={!text}>
      {copied ? "복사됨 ✓" : label}
    </Button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-emerald-600" />
      {label}
    </label>
  );
}

export function Badge({ tone = "default", children }: { tone?: "default" | "good" | "warn" | "loss" | "info"; children: ReactNode }) {
  const toneClass = {
    default: "bg-stone-100 text-stone-600",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    loss: "bg-rose-50 text-rose-700",
    info: "bg-sky-50 text-sky-700",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", toneClass)}>{children}</span>;
}

export const STATUS_LABEL: Record<MarginStatus, string> = { good: "정상", warn: "목표미달", loss: "역마진" };

export function StatusBadge({ status }: { status: MarginStatus }) {
  return <Badge tone={status}>{STATUS_LABEL[status]}</Badge>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:border-b [&_td]:border-stone-100 [&_td]:px-3 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-stone-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-stone-500">
        {children}
      </table>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">{children}</div>;
}
