"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CatPeeking } from "@/components/ui/illustrations";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:bg-brand-300 disabled:shadow-none dark:bg-brand-500 dark:hover:bg-brand-400 dark:disabled:bg-brand-900",
  secondary:
    "bg-white text-stone-700 shadow-sm ring-1 ring-inset ring-stone-200 hover:bg-stone-50 hover:text-stone-900 disabled:text-stone-400 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-700",
  ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className = "h-5 w-5", label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm text-stone-600 dark:text-stone-300">{label}</span>}
    </span>
  );
}

type AlertTone = "info" | "success" | "warning" | "error";
const ALERT_TONES: Record<AlertTone, string> = {
  info: "border-stone-200 bg-cream-50 text-stone-800 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
};

export function Alert({ tone = "info", title, children, className }: { tone?: AlertTone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", ALERT_TONES[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-stone-50 text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
  blue: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30",
  green: "bg-[#e8efe6] text-[#3f6146] ring-[#c7d8c6] dark:bg-[#24302a] dark:text-[#b5cfb9] dark:ring-[#3a4d40]",
  amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30",
  violet: "bg-[#f2e9df] text-[#8a5f43] ring-[#e2cfbd] dark:bg-[#33281f] dark:text-[#d9b89c] dark:ring-[#4d3c2e]",
};

export function Badge({ tone = "neutral", children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] dark:border-stone-800 dark:bg-stone-900 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
  illustration,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-14 text-center dark:border-stone-700 dark:bg-stone-900/40">
      {icon ? (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">{icon}</div>
      ) : (
        <div className="mx-auto mb-2 w-fit">{illustration ?? <CatPeeking className="h-20 w-36" />}</div>
      )}
      <p className="font-semibold text-stone-800 dark:text-stone-100">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-stone-600 dark:text-stone-300">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-stone-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-stone-500 dark:text-stone-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm ring-1 ring-inset ring-stone-200 transition placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-stone-800/80 dark:text-stone-100 dark:ring-stone-700 dark:focus:ring-brand-400";

export const labelClass = "mb-1.5 block text-[13px] font-medium text-stone-700 dark:text-stone-300";
