import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSettings, useProfilesMap, errMsg } from "@/lib/data";
import { fmtMoney, kigaliToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Glass, Field, selectCls, tableWrap, thCls, tdCls } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/income")({
  head: () => ({ meta: [{ title: "Room & Other Income — K POINT BAR" }] }),
  component: IncomePage,
});

function IncomePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: names = {} } = useProfilesMap();
  const cur = settings?.currency ?? "RWF";
  const [f, setF] = useState({ business_date: kigaliToday(), source: "room", description: "", amount: "", payment_method: "cash" });
  const list = useQuery({
    queryKey: ["income"],
    queryFn: async () => (await supabase.from("other_income").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(f.amount) > 0)) return toast.error(t("amount"));
    const { error } = await supabase.from("other_income").insert({ ...f, amount: Number(f.amount) });
    if (error) return toast.error(errMsg(error));
    toast.success(t("saved"));
    setF({ ...f, description: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["income"] });
  }

  return (
    <div>
      <PageHeader title={t("income")} subtitle="Record only income not already recorded as bar/kitchen sales." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Glass>
          <form onSubmit={add} className="grid gap-3">
            <Field label={t("date")}><Input type="date" value={f.business_date} onChange={(e) => setF({ ...f, business_date: e.target.value })} /></Field>
            <Field label={t("source")}>
              <select className={selectCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                <option value="room">{t("room")}</option><option value="other">{t("other")}</option>
              </select>
            </Field>
            <Field label={t("description")}><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label={t("amount")}><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label={t("paymentMethod")}>
              <select className={selectCls} value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>
                {["cash", "momo", "bank", "card"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </Field>
            <Button variant="hero" type="submit">{t("add")}</Button>
          </form>
        </Glass>
        <Glass className="lg:col-span-2">
          <div className={tableWrap}>
            <table className="w-full">
              <thead className="bg-muted/40"><tr>
                <th className={thCls}>{t("date")}</th><th className={thCls}>{t("source")}</th><th className={thCls}>{t("description")}</th>
                <th className={thCls}>{t("user")}</th><th className={thCls}>{t("paymentMethod")}</th><th className={thCls + " text-right"}>{t("amount")}</th>
              </tr></thead>
              <tbody>
                {(list.data ?? []).length === 0 && <tr><td colSpan={6} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
                {(list.data ?? []).map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td className={tdCls}>{x.business_date}</td><td className={tdCls}>{t(x.source)}</td>
                    <td className={tdCls + " whitespace-normal"}>{x.description}</td><td className={tdCls}>{names[x.employee_id] ?? "—"}</td>
                    <td className={tdCls}>{x.payment_method.toUpperCase()}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtMoney(Number(x.amount), cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Glass>
      </div>
    </div>
  );
}
