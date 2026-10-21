import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PackageX, ClipboardList, Scale, CalendarX, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useProducts } from "@/lib/data";
import { fmtNum, kigaliToday, addDays } from "@/lib/format";
import { PageHeader, Glass } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — K POINT BAR" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { data: products = [] } = useProducts();
  const today = kigaliToday();
  const data = useQuery({
    queryKey: ["alerts-data"],
    queryFn: async () => {
      const [reports, movements] = await Promise.all([
        supabase.from("daily_reports").select("business_date, status, cash_expected, cash_counted, report_items(product_id, expected, physical)").gte("business_date", addDays(today, -14)),
        supabase.from("stock_movements").select("product_id, movement_type, quantity, reason, created_at").in("movement_type", ["adjustment", "wastage"]).gte("business_date", addDays(today, -7)),
      ]);
      return { reports: reports.data ?? [], movements: movements.data ?? [] };
    },
  });
  const pname = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const out = products.filter((p) => Number(p.current_stock) <= 0);
  const low = products.filter((p) => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock));
  const noPrice = products.filter((p) => p.selling_price == null);
  const reps = data.data?.reports ?? [];
  const pending = reps.filter((r) => r.status === "submitted");
  const missing = Array.from({ length: 7 }, (_, i) => addDays(today, -1 - i)).filter((d) => !reps.some((r) => r.business_date === d));
  const disc = reps.flatMap((r) => r.report_items.filter((i) => i.physical != null && Number(i.physical) !== Number(i.expected))
    .map((i) => ({ date: r.business_date, name: pname[i.product_id] ?? "?", diff: Number(i.physical) - Number(i.expected) })));
  const unusual = (data.data?.movements ?? []).filter((m) => Math.abs(Number(m.quantity)) >= 10);

  const Section = ({ icon: Icon, title, tone, items }: { icon: typeof AlertTriangle; title: string; tone: string; items: React.ReactNode[] }) => (
    <Glass>
      <h2 className={"mb-3 flex items-center gap-2 font-semibold " + tone}><Icon className="h-4 w-4" /> {title} <span className="text-muted-foreground">({items.length})</span></h2>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
        {items.length ? items : <li className="text-muted-foreground">{t("noData")}</li>}
      </ul>
    </Glass>
  );

  return (
    <div>
      <PageHeader title={t("alerts")} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Section icon={PackageX} title={t("outOfStock")} tone="text-destructive" items={out.map((p) => <li key={p.id}>{p.name}</li>)} />
        <Section icon={AlertTriangle} title={t("lowStock")} tone="text-warning" items={low.map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span>{fmtNum(Number(p.current_stock))} / {fmtNum(Number(p.min_stock))}</span></li>)} />
        <Section icon={Tag} title={`${t("sellingPrice")}: ${t("notSet")}`} tone="text-warning" items={noPrice.map((p) => <li key={p.id}>{p.name}</li>)} />
        <Section icon={ClipboardList} title={t("pendingReports")} tone="text-warning" items={pending.map((r) => <li key={r.business_date}><Link to="/closing" className="hover:underline">{r.business_date}</Link></li>)} />
        <Section icon={CalendarX} title="Missing closing reports (7 days)" tone="text-destructive" items={missing.map((d) => <li key={d}>{d}</li>)} />
        <Section icon={Scale} title={`${t("physical")} ≠ expected`} tone="text-destructive" items={disc.map((d, i) => <li key={i} className="flex justify-between"><span>{d.date} · {d.name}</span><span>{fmtNum(d.diff)}</span></li>)} />
        {isAdmin && <Section icon={AlertTriangle} title="Unusual adjustments (≥10 units, 7 days)" tone="text-warning" items={unusual.map((m, i) => <li key={i} className="flex justify-between"><span>{pname[m.product_id]} · {m.reason}</span><span>{fmtNum(Number(m.quantity))}</span></li>)} />}
      </div>
    </div>
  );
}
