import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, Package, AlertTriangle, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useProducts, useSettings } from "@/lib/data";
import { fmtMoney, kigaliToday, addDays } from "@/lib/format";
import { fetchRange } from "@/lib/fetchRange";
import { summarize, productPerformance, salesByDay } from "@/lib/reports";
import { PageHeader, Glass, Stat, Empty } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — K POINT BAR" }] }),
  component: Dashboard,
});

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };

function Dashboard() {
  const { t } = useI18n();
  const { isAdmin, profile } = useAuth();
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "RWF";
  const today = kigaliToday();
  const from = addDays(today, -13);
  const { data: products = [] } = useProducts();

  const range = useQuery({ queryKey: ["dash-range", from, today], queryFn: () => fetchRange(from, today) });
  const reports = useQuery({
    queryKey: ["dash-reports"],
    queryFn: async () => (await supabase.from("daily_reports").select("id, business_date, status, cash_expected, cash_counted").order("business_date", { ascending: false }).limit(60)).data ?? [],
  });

  const d = range.data;
  const todayData = d && summarize({
    sales: d.sales.filter((s) => s.business_date === today),
    expenses: d.expenses.filter((s) => s.business_date === today),
    income: d.income.filter((s) => s.business_date === today),
    purchases: d.purchases.filter((s) => s.business_date === today),
  });
  const trend = d ? salesByDay(d.sales) : [];
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i)).map((date) => ({
    date: date.slice(5), total: trend.find((x) => x.date === date)?.total ?? 0,
  }));
  const top = d ? productPerformance(d.sales).slice(0, 8) : [];
  const sum = d && summarize(d);
  const cats = sum ? [{ name: t("drinks"), value: sum.drinks }, { name: t("kitchen"), value: sum.kitchen }] : [];

  const low = products.filter((p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock));
  const out = products.filter((p) => Number(p.current_stock) <= 0);
  const stockValue = products.reduce((s, p) => s + Number(p.current_stock) * Number(p.avg_cost), 0);
  const pending = (reports.data ?? []).filter((r) => r.status === "submitted").length;
  const discrepancies = (reports.data ?? []).filter((r) => Math.abs(Number(r.cash_counted) - Number(r.cash_expected)) >= 1).length;

  return (
    <div>
      <PageHeader title={`${t("dashboard")}`} subtitle={`${profile?.full_name || profile?.username} · ${today}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("todaySales")} value={fmtMoney(todayData?.revenue, cur)} icon={<TrendingUp className="h-4 w-4" />} tone="good" />
        <Stat label={t("purchases")} value={fmtMoney(todayData?.purchases, cur)} />
        <Stat label={t("expenses")} value={fmtMoney(todayData?.expenses, cur)} />
        <Stat label={t("income")} value={fmtMoney(todayData?.income, cur)} />
        {isAdmin && <Stat label={t("grossProfit")} value={fmtMoney(todayData?.gross, cur)} />}
        {isAdmin && <Stat label={t("netProfit")} value={fmtMoney(todayData?.net, cur)} tone={(todayData?.net ?? 0) < 0 ? "bad" : "good"} />}
        {isAdmin && <Stat label={t("stockValue")} value={fmtMoney(stockValue, cur)} icon={<Package className="h-4 w-4" />} />}
        <Stat label={t("lowStock")} value={low.length} tone={low.length ? "warn" : undefined} icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat label={t("outOfStock")} value={out.length} tone={out.length ? "bad" : undefined} />
        <Stat label={t("pendingReports")} value={pending} tone={pending ? "warn" : undefined} icon={<ClipboardList className="h-4 w-4" />} />
        {isAdmin && <Stat label={t("cashDiff")} value={discrepancies} tone={discrepancies ? "bad" : undefined} />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Glass className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">{t("salesTrend")}</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={days}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtMoney(v, cur)} />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Glass>
        <Glass>
          <h2 className="mb-3 font-semibold">{t("categorySales")}</h2>
          {sum && sum.revenue > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {cats.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--chart-1)" : "var(--chart-2)"} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtMoney(v, cur)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty text={t("noData")} />}
        </Glass>
        <Glass className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">{t("topProducts")}</h2>
          {top.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical">
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={110} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtMoney(v, cur)} />
                  <Bar dataKey="revenue" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty text={t("noData")} />}
        </Glass>
        <Glass>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("alerts")}</h2>
            <Link to="/alerts" className="text-sm text-primary hover:underline">→</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {out.slice(0, 5).map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-destructive">{t("outOfStock")}</span></li>)}
            {low.slice(0, 5).map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-warning">{t("lowStock")}</span></li>)}
            {!out.length && !low.length && <li className="text-muted-foreground">{t("noData")}</li>}
          </ul>
        </Glass>
      </div>
    </div>
  );
}
