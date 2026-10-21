export const fmtMoney = (n: number | null | undefined, currency = "RWF") =>
  n == null ? "—" : `${Math.round(Number(n)).toLocaleString("en-US")} ${currency}`;

export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });

/** Business day in Kigali (UTC+2) as YYYY-MM-DD */
export const kigaliToday = () => {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type PeriodKind = "daily" | "weekly" | "monthly" | "yearly" | "custom";

/** Returns inclusive [from, to] ISO dates for a period containing `anchor`. Weeks start Monday. */
export function periodRange(kind: Exclude<PeriodKind, "custom">, anchor: string): [string, string] {
  const d = new Date(anchor + "T00:00:00Z");
  if (kind === "daily") return [anchor, anchor];
  if (kind === "weekly") {
    const dow = (d.getUTCDay() + 6) % 7;
    const start = addDays(anchor, -dow);
    return [start, addDays(start, 6)];
  }
  if (kind === "monthly") {
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    return [start, end];
  }
  const y = d.getUTCFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

/** Password policy for new passwords */
export const strongPassword = (p: string) =>
  p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

export const usernameToEmail = (u: string) =>
  `${u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@kpointbar.local`;
