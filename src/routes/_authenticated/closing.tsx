import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSettings, useProfilesMap, errMsg } from "@/lib/data";
import { fmtMoney, fmtNum, kigaliToday } from "@/lib/format";
import { exportCsv, exportPdf, exportDocx, type ExportTable } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Glass, Field, tableWrap, thCls, tdCls, Stat, StatusBadge } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/closing")({
  head: () => ({ meta: [{ title: "Daily Closing — K POINT BAR" }] }),
  component: ClosingPage,
});

function ClosingPage() {
  const { t } = useI18n();
  const { isAdmin, can } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: names = {} } = useProfilesMap();
  const cur = settings?.currency ?? "RWF";
  const [day, setDay] = useState(kigaliToday());
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const report = useQuery({
    queryKey: ["daily-report", day],
    queryFn: async () => {
      const { data } = await supabase.from("daily_reports").select("*, report_items(*)").eq("business_date", day).maybeSingle();
      return data;
    },
  });
  const sheet = useQuery({
    queryKey: ["closing-sheet", day],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("closing_sheet", { _date: day });
      if (error) throw error;
      return data ?? [];
    },
  });
  const totals = useQuery({
    queryKey: ["closing-totals", day],
    queryFn: async () => {
      const [pu, ex, oi, sa] = await Promise.all([
        supabase.from("purchases").select("total").eq("business_date", day).eq("status", "received"),
        supabase.from("expenses").select("amount, payment_method, status").eq("business_date", day).neq("status", "rejected"),
        supabase.from("other_income").select("amount, payment_method").eq("business_date", day),
        supabase.from("sales").select("total, cost_total, payment_method").eq("business_date", day),
      ]);
      const sum = (a: { [k: string]: unknown }[] | null, k: string, f?: (r: any) => boolean) =>
        (a ?? []).filter(f ?? (() => true)).reduce((s, r) => s + Number(r[k]), 0);
      return {
        purchases: sum(pu.data, "total"),
        expenses: sum(ex.data, "amount"),
        income: sum(oi.data, "amount"),
        cogs: sum(sa.data, "cost_total"),
        cashExpected: sum(sa.data, "total", (r) => r.payment_method === "cash") + sum(oi.data, "amount", (r) => r.payment_method === "cash") - sum(ex.data, "amount", (r) => r.payment_method === "cash"),
      };
    },
  });

  const rep = report.data;
  const locked = rep?.status === "approved" || (rep?.status === "submitted" && !isAdmin);

  useEffect(() => {
    if (rep) {
      setCounts(Object.fromEntries(rep.report_items.filter((i) => i.physical != null).map((i) => [i.product_id, String(i.physical)])));
      setCash(String(rep.cash_counted ?? ""));
      setNotes(rep.notes ?? "");
    } else {
      setCounts({}); setCash(""); setNotes("");
    }
  }, [rep?.id, rep?.submitted_at]);

  // When approved, show the frozen report rows; otherwise the live ledger
  const rows = useMemo(() => {
    if (rep && rep.status === "approved") {
      const nameMap = Object.fromEntries((sheet.data ?? []).map((s) => [s.product_id, s]));
      return rep.report_items.map((i) => ({
        product_id: i.product_id, name: nameMap[i.product_id]?.name ?? "?", category: nameMap[i.product_id]?.category ?? "",
        opening: Number(i.opening), purchased: Number(i.purchased), adjustments: Number(i.adjustments), sold: Number(i.sold),
        expected: Number(i.expected), unit_price: Number(i.unit_price), total: Number(i.total), physical: i.physical == null ? null : Number(i.physical),
      })).sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
    }
    return (sheet.data ?? []).map((s) => ({
      ...s, opening: Number(s.opening), purchased: Number(s.purchased), adjustments: Number(s.adjustments), sold: Number(s.sold),
      expected: Number(s.expected), unit_price: Number(s.unit_price), total: Number(s.total),
      physical: counts[s.product_id] != null && counts[s.product_id] !== "" ? Number(counts[s.product_id]) : null,
    }));
  }, [rep, sheet.data, counts]);

  const drinks = rows.filter((r) => r.category === "drinks").reduce((s, r) => s + r.total, 0);
  const kitchen = rows.filter((r) => r.category === "kitchen").reduce((s, r) => s + r.total, 0);
  const tot = totals.data;
  const gross = drinks + kitchen - (tot?.cogs ?? 0);
  const net = gross + (tot?.income ?? 0) - (tot?.expenses ?? 0);
  const cashDiff = (Number(cash) || 0) - (tot?.cashExpected ?? 0);

  async function submit() {
    setBusy(true);
    const payload = Object.entries(counts).filter(([, v]) => v !== "").map(([product_id, physical]) => ({ product_id, physical: Number(physical) }));
    const { error } = await supabase.rpc("submit_daily_report", { _date: day, _counts: payload, _cash: Number(cash) || 0, _notes: notes });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(t("reportSubmitted"));
    qc.invalidateQueries({ queryKey: ["daily-report", day] });
  }
  async function review(approve: boolean) {
    if (!rep) return;
    setBusy(true);
    const { error } = await supabase.rpc("review_daily_report", { _report: rep.id, _approve: approve, _comment: comment });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(t("saved"));
    setComment("");
    qc.invalidateQueries();
  }
  async function reopen() {
    if (!rep) return;
    if (!comment.trim()) return toast.error(t("reason"));
    const { error } = await supabase.rpc("reopen_daily_report", { _report: rep.id, _comment: comment });
    if (error) return toast.error(errMsg(error));
    setComment("");
    qc.invalidateQueries();
  }

  const exportTable = (): ExportTable => ({
    title: "K POINT BAR SALES REPORT",
    subtitle: day,
    businessName: settings?.business_name ?? "K POINT BAR",
    columns: ["PRODUCT", "INSTOCK", "PURCHASED", "ST AFT SALES", "SOLD", "P UNIT", "P TOTAL", "PHYSICAL", "VARIANCE"],
    rows: rows.map((r) => [r.name, r.opening + r.adjustments, r.purchased, r.expected, r.sold, r.unit_price, r.total,
      r.physical ?? "", r.physical == null ? "" : r.physical - r.expected]),
    totals: [
      ["Total drinks", fmtMoney(drinks, cur)], ["Total kitchen", fmtMoney(kitchen, cur)], ["Total sales", fmtMoney(drinks + kitchen, cur)],
      ["Purchases", fmtMoney(tot?.purchases, cur)], ["Expenses", fmtMoney(tot?.expenses, cur)], ["Other income", fmtMoney(tot?.income, cur)],
      ["Est. gross profit", fmtMoney(gross, cur)], ["Est. net profit", fmtMoney(net, cur)],
      ["Cash expected", fmtMoney(tot?.cashExpected, cur)], ["Cash counted", fmtMoney(Number(cash) || 0, cur)],
    ],
  });

  return (
    <div>
      <PageHeader
        title={t("closing")}
        subtitle={rep ? `${t("submitted")}: ${names[rep.submitted_by ?? ""] ?? ""} · ${new Date(rep.submitted_at).toLocaleString()}` : undefined}
        actions={
          <>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-40" />
            {can("export") && (
              <>
                <Button variant="glass" size="sm" onClick={() => exportPdf(exportTable())}>PDF</Button>
                <Button variant="glass" size="sm" onClick={() => exportCsv(exportTable())}>CSV</Button>
                <Button variant="glass" size="sm" onClick={() => exportDocx(exportTable())}>DOCX</Button>
              </>
            )}
          </>
        }
      />
      {rep && (
        <Glass className="mb-4 flex flex-wrap items-center gap-3">
          <StatusBadge status={rep.status} label={t(rep.status)} />
          {rep.status === "approved" && <span className="flex items-center gap-1 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> {t("reportLocked")}</span>}
          {rep.admin_comment && <span className="text-sm"><b>{t("adminComment")}:</b> {rep.admin_comment}</span>}
        </Glass>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("totalDrinks")} value={fmtMoney(drinks, cur)} />
        <Stat label={t("totalKitchen")} value={fmtMoney(kitchen, cur)} />
        <Stat label={t("totalSales")} value={fmtMoney(drinks + kitchen, cur)} tone="good" />
        <Stat label={t("purchases")} value={fmtMoney(tot?.purchases, cur)} />
        <Stat label={t("expenses")} value={fmtMoney(tot?.expenses, cur)} />
        <Stat label={t("income")} value={fmtMoney(tot?.income, cur)} />
        <Stat label={t("grossProfit")} value={fmtMoney(gross, cur)} tone={gross < 0 ? "bad" : "good"} />
        <Stat label={t("netProfit")} value={fmtMoney(net, cur)} tone={net < 0 ? "bad" : "good"} />
      </div>
      <Glass className="mb-4">
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="bg-muted/40"><tr>
              <th className={thCls}>{t("product")}</th>
              <th className={thCls + " text-right"}>{t("instock")}</th>
              <th className={thCls + " text-right"}>{t("purchased")}</th>
              <th className={thCls + " text-right"}>{t("stAftSales")}</th>
              <th className={thCls + " text-right"}>{t("sold")}</th>
              <th className={thCls + " text-right"}>{t("pUnit")}</th>
              <th className={thCls + " text-right"}>{t("pTotal")}</th>
              <th className={thCls + " text-right"}>{t("physical")}</th>
              <th className={thCls + " text-right"}>{t("variance")}</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const variance = r.physical == null ? null : r.physical - r.expected;
                const header = i === 0 || rows[i - 1]?.category !== r.category;
                return [
                  header && (
                    <tr key={r.category} className="bg-primary/10"><td colSpan={9} className={tdCls + " font-semibold text-primary"}>{t(r.category)}</td></tr>
                  ),
                  <tr key={r.product_id} className="border-t border-border">
                    <td className={tdCls + " font-medium"}>{r.name}</td>
                    <td className={tdCls + " text-right"}>{fmtNum(r.opening + r.adjustments)}</td>
                    <td className={tdCls + " text-right"}>{fmtNum(r.purchased)}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtNum(r.expected)}</td>
                    <td className={tdCls + " text-right"}>{fmtNum(r.sold)}</td>
                    <td className={tdCls + " text-right"}>{fmtMoney(r.unit_price, "")}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtMoney(r.total, "")}</td>
                    <td className={tdCls + " text-right"}>
                      {locked ? fmtNum(r.physical) : (
                        <Input type="number" min={0} className="ml-auto h-8 w-24 text-right" value={counts[r.product_id] ?? ""}
                          onChange={(e) => setCounts({ ...counts, [r.product_id]: e.target.value })} />
                      )}
                    </td>
                    <td className={tdCls + " text-right " + (variance && variance < 0 ? "text-destructive" : variance && variance > 0 ? "text-warning" : "")}>
                      {variance == null ? "—" : fmtNum(variance)}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </Glass>
      <div className="grid gap-4 md:grid-cols-2">
        <Glass>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("cashExpected")} value={fmtMoney(tot?.cashExpected, cur)} />
            <Stat label={t("cashDiff")} value={fmtMoney(cashDiff, cur)} tone={cashDiff < 0 ? "bad" : cashDiff > 0 ? "warn" : "good"} />
          </div>
          <div className="mt-4 grid gap-3">
            <Field label={t("cashCounted")}><Input type="number" min={0} value={cash} disabled={locked} onChange={(e) => setCash(e.target.value)} /></Field>
            <Field label={t("notes")}><Input value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} /></Field>
            {!locked && (
              <Button variant="hero" onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {t("submitReport")}</Button>
            )}
          </div>
        </Glass>
        {isAdmin && rep && (
          <Glass>
            <h3 className="mb-3 font-semibold">{t("approve")} / {t("returnForCorrection")}</h3>
            <Field label={t("adminComment")}><Input value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            <div className="mt-3 flex flex-wrap gap-2">
              {rep.status === "submitted" && (
                <>
                  <Button variant="hero" onClick={() => review(true)} disabled={busy}>{t("approve")}</Button>
                  <Button variant="outline" onClick={() => review(false)} disabled={busy}>{t("returnForCorrection")}</Button>
                </>
              )}
              {rep.status === "approved" && <Button variant="outline" onClick={reopen}>{t("reopen")}</Button>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Approving records each physical-count variance as an auditable stock adjustment.
            </p>
          </Glass>
        )}
      </div>
    </div>
  );
}
