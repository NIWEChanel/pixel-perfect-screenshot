import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, FileType, Sheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useProducts, useProfilesMap, useSettings } from "@/lib/data";
import { fetchRange } from "@/lib/fetchRange";
import { summarize, productPerformance, type SaleRow } from "@/lib/reports";
import { exportCsv, exportPdf, exportDocx, type ExportTable } from "@/lib/export";
import { fmtMoney, kigaliToday, addDays, periodRange, type PeriodKind } from "@/lib/format";
import { PageHeader, Glass, Empty, Field, selectCls, tableWrap, thCls, tdCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — K POINT BAR" },
      { name: "description", content: "Sales, stock, profit and cash reports for any period, exportable to PDF, CSV and Word." },
      { property: "og:title", content: "Reports — K POINT BAR" },
      { property: "og:description", content: "Sales, stock, profit and cash reports for any period, exportable to PDF, CSV and Word." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const TYPES = [
  "summary",
  "sales",
  "purchases",
  "expenses",
  "income",
  "product_performance",
  "stock_balances",
  "stock_movements",
  "low_stock",
  "employee_activity",
  "daily_closing",
  "discrepancies",
  "cash_reconciliation",
  "supplier_purchases",
] as const;
type ReportType = (typeof TYPES)[number];

const LABEL: Record<ReportType, string> = {
  summary: "summary",
  sales: "sales",
  purchases: "purchases",
  expenses: "expenses",
  income: "income",
  product_performance: "productPerformance",
  stock_balances: "stockBalances",
  stock_movements: "stockMovements",
  low_stock: "lowStock",
  employee_activity: "employeeActivity",
  daily_closing: "closing",
  discrepancies: "cashDiff",
  cash_reconciliation: "cashRecon",
  supplier_purchases: "suppliers",
};

type Row = (string | number)[];
type Built = { columns: string[]; rows: Row[]; totals?: [string, string][] };

const rnd = (n: number) => Math.round(n);

function supplierName(p: unknown): string {
  const s = (p as { suppliers?: unknown } | null)?.suppliers;
  if (Array.isArray(s)) return (s[0] as { name?: string } | undefined)?.name ?? "—";
  return (s as { name?: string } | null)?.name ?? "—";
}

function shift(kind: PeriodKind, iso: string, dir: number): string {
  if (kind === "daily" || kind === "custom") return addDays(iso, dir);
  if (kind === "weekly") return addDays(iso, dir * 7);
  const d = new Date(`${iso}T00:00:00Z`);
  if (kind === "monthly") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1)).toISOString().slice(0, 10);
  return `${d.getUTCFullYear() + dir}-01-01`;
}

function ReportsPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "RWF";
  const { data: products = [] } = useProducts(true);
  const { data: names = {} } = useProfilesMap();

  const [kind, setKind] = useState<PeriodKind>("daily");
  const [anchor, setAnchor] = useState(kigaliToday());
  const [cf, setCf] = useState(addDays(kigaliToday(), -29));
  const [ct, setCt] = useState(kigaliToday());
  const [type, setType] = useState<ReportType>("summary");
  const [category, setCategory] = useState("all");
  const [productId, setProductId] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [payment, setPayment] = useState("all");

  const [from, to] = kind === "custom" ? [cf, ct] : periodRange(kind, anchor);
  const period = `${from} → ${to}`;

  const bundle = useQuery({
    queryKey: ["report-bundle", from, to],
    queryFn: async () => {
      const rng = await fetchRange(from, to);
      const [mov, rep] = await Promise.all([
        supabase
          .from("stock_movements")
          .select("*")
          .gte("business_date", from)
          .lte("business_date", to)
          .order("business_date")
          .limit(5000),
        supabase
          .from("daily_reports")
          .select("*")
          .gte("business_date", from)
          .lte("business_date", to)
          .order("business_date")
          .limit(400),
      ]);
      return { rng, movements: mov.data ?? [], reports: rep.data ?? [] };
    },
  });

  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const built = useMemo<Built | null>(() => {
    const d = bundle.data;
    if (!d) return null;
    const itemOk = (i: { category: string; product_id: string }) =>
      (category === "all" || i.category === category) && (productId === "all" || i.product_id === productId);
    const saleOk = (s: SaleRow) =>
      (employeeId === "all" || s.employee_id === employeeId) && (payment === "all" || s.payment_method === payment);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

    switch (type) {
      case "summary": {
        const s = summarize(d.rng);
        return {
          columns: [t("summary"), t("total")],
          rows: [
            [t("totalSales"), rnd(s.revenue)],
            [t("drinks"), rnd(s.drinks)],
            [t("kitchen"), rnd(s.kitchen)],
            [t("cogs"), rnd(s.cogs)],
            [t("grossProfit"), rnd(s.gross)],
            [t("expenses"), rnd(s.expenses)],
            [t("income"), rnd(s.income)],
            [t("netProfit"), rnd(s.net)],
            [t("purchases"), rnd(s.purchases)],
            [t("entries"), d.rng.sales.length],
          ],
        };
      }
      case "sales": {
        const kept = d.rng.sales
          .filter(saleOk)
          .map((s) => {
            const items = s.items.filter(itemOk);
            return {
              s,
              qty: sum(items.map((i) => i.quantity)),
              rev: sum(items.map((i) => i.line_total)),
              cost: sum(items.map((i) => i.quantity * i.unit_cost)),
            };
          })
          .filter((x) => x.qty > 0);
        return {
          columns: [t("date"), t("user"), t("paymentMethod"), t("quantity"), t("revenue"), t("cogs"), t("grossProfit")],
          rows: kept.map((x) => [
            x.s.business_date,
            names[x.s.employee_id] ?? "—",
            x.s.payment_method,
            x.qty,
            rnd(x.rev),
            rnd(x.cost),
            rnd(x.rev - x.cost),
          ]),
          totals: [
            [t("revenue"), fmtMoney(sum(kept.map((x) => x.rev)), cur)],
            [t("cogs"), fmtMoney(sum(kept.map((x) => x.cost)), cur)],
            [t("grossProfit"), fmtMoney(sum(kept.map((x) => x.rev - x.cost)), cur)],
          ],
        };
      }
      case "purchases": {
        const rows = d.rng.purchases.map((p) => [
          p.business_date,
          supplierName(p),
          p.invoice_no ?? "—",
          p.status,
          p.payment_status,
          rnd(p.total),
        ]);
        return {
          columns: [t("date"), t("supplier"), t("invoice"), t("status"), t("paymentStatus"), t("total")],
          rows,
          totals: [[t("total"), fmtMoney(sum(d.rng.purchases.map((p) => p.total)), cur)]],
        };
      }
      case "expenses": {
        const kept = d.rng.expenses.filter((e) => employeeId === "all" || e.employee_id === employeeId);
        return {
          columns: [t("date"), t("category"), t("description"), t("paymentMethod"), t("user"), t("status"), t("amount")],
          rows: kept.map((e) => [
            e.business_date,
            e.category,
            e.description ?? "—",
            e.payment_method,
            names[e.employee_id] ?? "—",
            e.status,
            rnd(e.amount),
          ]),
          totals: [
            [t("total"), fmtMoney(sum(kept.filter((e) => e.status !== "rejected").map((e) => e.amount)), cur)],
          ],
        };
      }
      case "income": {
        const kept = d.rng.income.filter((e) => employeeId === "all" || e.employee_id === employeeId);
        return {
          columns: [t("date"), t("source"), t("description"), t("paymentMethod"), t("user"), t("amount")],
          rows: kept.map((e) => [
            e.business_date,
            e.source,
            e.description ?? "—",
            e.payment_method,
            names[e.employee_id] ?? "—",
            rnd(e.amount),
          ]),
          totals: [[t("total"), fmtMoney(sum(kept.map((e) => e.amount)), cur)]],
        };
      }
      case "product_performance": {
        const perf = productPerformance(d.rng.sales, category === "all" ? undefined : category).filter(
          (p) => productId === "all" || p.name === (pmap.get(productId)?.name ?? ""),
        );
        return {
          columns: [t("product"), t("category"), t("quantity"), t("revenue"), t("cogs"), t("grossProfit")],
          rows: perf.map((p) => [p.name, p.category, p.qty, rnd(p.revenue), rnd(p.cost), rnd(p.revenue - p.cost)]),
          totals: [
            [t("revenue"), fmtMoney(sum(perf.map((p) => p.revenue)), cur)],
            [t("grossProfit"), fmtMoney(sum(perf.map((p) => p.revenue - p.cost)), cur)],
          ],
        };
      }
      case "stock_balances": {
        const list = products.filter((p) => !p.archived && (category === "all" || p.category === category));
        return {
          columns: [t("product"), t("category"), t("unit"), t("stock"), t("minStock"), t("costPrice"), t("stockValue"), t("status")],
          rows: list.map((p) => {
            const stock = Number(p.current_stock);
            const min = Number(p.min_stock);
            const status = stock <= 0 ? t("outOfStock") : stock <= min ? t("lowStock") : t("active");
            return [
              p.name,
              p.category,
              p.unit,
              stock,
              min,
              rnd(Number(p.avg_cost)),
              rnd(stock * Number(p.avg_cost)),
              status,
            ];
          }),
          totals: [[t("stockValue"), fmtMoney(sum(list.map((p) => Number(p.current_stock) * Number(p.avg_cost))), cur)]],
        };
      }
      case "stock_movements": {
        const rows = d.movements
          .filter((m) => productId === "all" || m.product_id === productId)
          .map((m) => [
            m.business_date,
            pmap.get(m.product_id)?.name ?? "—",
            m.movement_type,
            Number(m.quantity),
            rnd(Number(m.unit_cost)),
            m.reason ?? "—",
            names[m.created_by ?? ""] ?? "—",
          ]);
        return {
          columns: [t("date"), t("product"), t("adjustType"), t("quantity"), t("costPrice"), t("reason"), t("user")],
          rows,
          totals: [[t("entries"), String(rows.length)]],
        };
      }
      case "low_stock": {
        const list = products.filter(
          (p) => !p.archived && Number(p.current_stock) <= Number(p.min_stock) && (category === "all" || p.category === category),
        );
        return {
          columns: [t("product"), t("category"), t("unit"), t("stock"), t("minStock"), t("status")],
          rows: list.map((p) => [
            p.name,
            p.category,
            p.unit,
            Number(p.current_stock),
            Number(p.min_stock),
            Number(p.current_stock) <= 0 ? t("outOfStock") : t("lowStock"),
          ]),
          totals: [[t("entries"), String(list.length)]],
        };
      }
      case "employee_activity": {
        const byUser = new Map<string, { sales: number; revenue: number; cost: number; expenses: number; purchases: number }>();
        const touch = (id: string) => {
          const cur0 = byUser.get(id) ?? { sales: 0, revenue: 0, cost: 0, expenses: 0, purchases: 0 };
          byUser.set(id, cur0);
          return cur0;
        };
        for (const s of d.rng.sales) {
          const r = touch(s.employee_id);
          r.sales += 1;
          r.revenue += Number(s.total);
          r.cost += Number(s.cost_total);
        }
        for (const e of d.rng.expenses) touch(e.employee_id).expenses += 1;
        for (const p of d.rng.purchases) if (p.received_by) touch(p.received_by).purchases += 1;
        return {
          columns: [t("user"), t("sales"), t("revenue"), t("cogs"), t("expenses"), t("purchases")],
          rows: [...byUser.entries()]
            .filter(([id]) => employeeId === "all" || id === employeeId)
            .map(([id, r]) => [names[id] ?? "—", r.sales, rnd(r.revenue), rnd(r.cost), r.expenses, r.purchases]),
          totals: [
            [t("sales"), String(sum([...byUser.values()].map((r) => r.sales)))],
            [t("revenue"), fmtMoney(sum([...byUser.values()].map((r) => r.revenue)), cur)],
          ],
        };
      }
      case "daily_closing": {
        const rows = d.reports.map((r) => [
          r.business_date,
          r.status,
          rnd(Number(r.drinks_sales ?? 0)),
          rnd(Number(r.kitchen_sales ?? 0)),
          rnd(Number(r.total_sales ?? 0)),
          rnd(Number(r.cogs ?? 0)),
          rnd(Number(r.total_expenses ?? 0)),
          rnd(Number(r.other_income ?? 0)),
          rnd(Number(r.cash_expected ?? 0)),
          rnd(Number(r.cash_counted ?? 0)),
          rnd(Number(r.cash_counted ?? 0) - Number(r.cash_expected ?? 0)),
        ]);
        return {
          columns: [
            t("date"), t("status"), t("drinks"), t("kitchen"), t("totalSales"), t("cogs"),
            t("expenses"), t("income"), t("cashExpected"), t("cashCounted"), t("variance"),
          ],
          rows,
          totals: [
            [t("totalSales"), fmtMoney(sum(d.reports.map((r) => Number(r.total_sales ?? 0))), cur)],
            [t("variance"), fmtMoney(sum(d.reports.map((r) => Number(r.cash_counted ?? 0) - Number(r.cash_expected ?? 0))), cur)],
          ],
        };
      }
      case "discrepancies": {
        const list = d.reports.filter((r) => Math.abs(Number(r.cash_counted ?? 0) - Number(r.cash_expected ?? 0)) >= 1);
        return {
          columns: [t("date"), t("status"), t("cashExpected"), t("cashCounted"), t("variance")],
          rows: list.map((r) => [
            r.business_date,
            r.status,
            rnd(Number(r.cash_expected ?? 0)),
            rnd(Number(r.cash_counted ?? 0)),
            rnd(Number(r.cash_counted ?? 0) - Number(r.cash_expected ?? 0)),
          ]),
          totals: [[t("variance"), fmtMoney(sum(list.map((r) => Number(r.cash_counted ?? 0) - Number(r.cash_expected ?? 0))), cur)]],
        };
      }
      case "cash_reconciliation": {
        const byMethod = new Map<string, { n: number; total: number }>();
        for (const s of d.rng.sales) {
          const r = byMethod.get(s.payment_method) ?? { n: 0, total: 0 };
          r.n += 1;
          r.total += Number(s.total);
          byMethod.set(s.payment_method, r);
        }
        const counted = sum(d.reports.map((r) => Number(r.cash_counted ?? 0)));
        const expected = sum(d.reports.map((r) => Number(r.cash_expected ?? 0)));
        return {
          columns: [t("paymentMethod"), t("entries"), t("total")],
          rows: [
            ...[...byMethod.entries()].map(([m, r]) => [m, r.n, rnd(r.total)]),
            [t("cashExpected"), "", rnd(expected)],
            [t("cashCounted"), "", rnd(counted)],
            [t("variance"), "", rnd(counted - expected)],
          ],
          totals: [[t("totalSales"), fmtMoney(sum([...byMethod.values()].map((r) => r.total)), cur)]],
        };
      }
      case "supplier_purchases": {
        const bySup = new Map<string, { n: number; total: number; unpaid: number }>();
        for (const p of d.rng.purchases) {
          const key = supplierName(p);
          const r = bySup.get(key) ?? { n: 0, total: 0, unpaid: 0 };
          r.n += 1;
          r.total += Number(p.total);
          if (p.payment_status !== "paid") r.unpaid += Number(p.total);
          bySup.set(key, r);
        }
        return {
          columns: [t("supplier"), t("entries"), t("total"), t("unpaid")],
          rows: [...bySup.entries()].map(([name, r]) => [name, r.n, rnd(r.total), rnd(r.unpaid)]),
          totals: [
            [t("total"), fmtMoney(sum([...bySup.values()].map((r) => r.total)), cur)],
            [t("unpaid"), fmtMoney(sum([...bySup.values()].map((r) => r.unpaid)), cur)],
          ],
        };
      }
    }
  }, [bundle.data, type, category, productId, employeeId, payment, pmap, names, t, cur]);

  const table: ExportTable | null = built
    ? {
        title: t(LABEL[type]),
        subtitle: period,
        businessName: settings?.business_name ?? "K POINT BAR",
        columns: built.columns,
        rows: built.rows,
        totals: built.totals,
      }
    : null;

  const paymentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of bundle.data?.rng.sales ?? []) set.add(s.payment_method);
    return [...set].sort();
  }, [bundle.data]);

  const productOptions = useMemo(
    () => products.filter((p) => !p.archived && (category === "all" || p.category === category)),
    [products, category],
  );

  const cell = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 3 }) : v);

  return (
    <div>
      <PageHeader
        title={t("reports")}
        subtitle={period}
        actions={
          table && can("export") ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportCsv(table)}>
                <Sheet /> CSV
              </Button>
              <Button variant="outline" onClick={() => void exportPdf(table)}>
                <FileText /> PDF
              </Button>
              <Button variant="outline" onClick={() => void exportDocx(table)}>
                <FileType /> DOCX
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
          )
        }
      />

      <Glass className="mb-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Field label={t("period")}>
            <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as PeriodKind)}>
              <option value="daily">{t("daily")}</option>
              <option value="weekly">{t("weekly")}</option>
              <option value="monthly">{t("monthly")}</option>
              <option value="yearly">{t("yearly")}</option>
              <option value="custom">{t("custom")}</option>
            </select>
          </Field>
          {kind === "custom" ? (
            <>
              <Field label={t("from")}>
                <Input type="date" value={cf} onChange={(e) => setCf(e.target.value)} />
              </Field>
              <Field label={t("to")}>
                <Input type="date" value={ct} onChange={(e) => setCt(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label={t("date")}>
              <div className="flex gap-2">
                <Button size="icon" variant="outline" aria-label={t("prev")} onClick={() => setAnchor((a) => shift(kind, a, -1))}>
                  ‹
                </Button>
                <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
                <Button size="icon" variant="outline" aria-label={t("next")} onClick={() => setAnchor((a) => shift(kind, a, 1))}>
                  ›
                </Button>
              </div>
            </Field>
          )}
          <Field label={t("reportType")}>
            <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(LABEL[x])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("category")}>
            <select
              className={selectCls}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setProductId("all");
              }}
            >
              <option value="all">{t("all")}</option>
              <option value="drinks">{t("drinks")}</option>
              <option value="kitchen">{t("kitchen")}</option>
            </select>
          </Field>
          <Field label={t("product")}>
            <select className={selectCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="all">{t("all")}</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("user")}>
            <select className={selectCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="all">{t("all")}</option>
              {Object.entries(names).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("paymentMethod")}>
            <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="all">{t("all")}</option>
              {paymentOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Glass>

      {built ? (
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {built.columns.map((c) => (
                  <th key={c} className={thCls}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {built.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {r.map((v, j) => (
                    <td key={j} className={tdCls}>
                      {cell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {built.totals?.length ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border px-3 py-3 text-sm">
              {built.totals.map(([k, v]) => (
                <span key={k}>
                  <span className="text-muted-foreground">{k}: </span>
                  <span className="font-semibold">{v}</span>
                </span>
              ))}
            </div>
          ) : null}
          {!built.rows.length && <Empty text={t("noData")} />}
        </div>
      ) : (
        <Glass>
          <Empty text={t("loading")} />
        </Glass>
      )}
    </div>
  );
}
