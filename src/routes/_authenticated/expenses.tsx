import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSettings, useProfilesMap, errMsg } from "@/lib/data";
import { fmtMoney, kigaliToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Glass, Field, selectCls, tableWrap, thCls, tdCls, StatusBadge } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — K POINT BAR" }] }),
  component: ExpensesPage,
});

const CATEGORIES = ["Salaries", "Utilities", "Rent", "Transport", "Supplies", "Maintenance", "Taxes", "Other"];

function ExpensesPage() {
  const { t } = useI18n();
  const { isAdmin, can } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: names = {} } = useProfilesMap();
  const cur = settings?.currency ?? "RWF";
  const [f, setF] = useState({ business_date: kigaliToday(), category: CATEGORIES[0], description: "", amount: "", payment_method: "cash" });

  const list = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!(Number(f.amount) > 0)) return toast.error(t("amount"));
    const { error } = await supabase.from("expenses").insert({
      ...f, amount: Number(f.amount), status: isAdmin ? "approved" : "pending",
    });
    if (error) return toast.error(errMsg(error));
    toast.success(t("saved"));
    setF({ ...f, description: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div>
      <PageHeader title={t("expenses")} />
      <div className="grid gap-4 lg:grid-cols-3">
        {can("expenses") && (
          <Glass>
            <form onSubmit={add} className="grid gap-3">
              <Field label={t("date")}><Input type="date" value={f.business_date} onChange={(e) => setF({ ...f, business_date: e.target.value })} /></Field>
              <Field label={t("category")}>
                <select className={selectCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
        )}
        <Glass className={can("expenses") ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className={tableWrap}>
            <table className="w-full">
              <thead className="bg-muted/40"><tr>
                <th className={thCls}>{t("date")}</th><th className={thCls}>{t("category")}</th><th className={thCls}>{t("description")}</th>
                <th className={thCls}>{t("user")}</th><th className={thCls + " text-right"}>{t("amount")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th>
              </tr></thead>
              <tbody>
                {(list.data ?? []).length === 0 && <tr><td colSpan={7} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
                {(list.data ?? []).map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td className={tdCls}>{x.business_date}</td><td className={tdCls}>{x.category}</td>
                    <td className={tdCls + " whitespace-normal"}>{x.description}</td><td className={tdCls}>{names[x.employee_id] ?? "—"}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtMoney(Number(x.amount), cur)}</td>
                    <td className={tdCls}><StatusBadge status={x.status} label={t(x.status)} /></td>
                    <td className={tdCls}>
                      {isAdmin && x.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="hero" onClick={() => setStatus(x.id, "approved")}>{t("approve")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(x.id, "rejected")}>{t("reject")}</Button>
                        </div>
                      )}
                    </td>
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
