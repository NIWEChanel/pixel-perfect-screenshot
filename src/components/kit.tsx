import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl p-4 md:p-5", className)}>{children}</div>;
}

export function Stat({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: "warn" | "bad" | "good"; icon?: ReactNode }) {
  return (
    <Glass className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div
        className={cn(
          "font-display text-xl font-semibold md:text-2xl",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-success",
        )}
      >
        {value}
      </div>
    </Glass>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "approved" || status === "received" || status === "active"
      ? "bg-success/15 text-success"
      : status === "rejected" || status === "returned" || status === "cancelled" || status === "inactive"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export const selectCls =
  "h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export const tableWrap = "overflow-x-auto rounded-xl border border-border";
export const thCls = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground";
export const tdCls = "whitespace-nowrap px-3 py-2 text-sm";
