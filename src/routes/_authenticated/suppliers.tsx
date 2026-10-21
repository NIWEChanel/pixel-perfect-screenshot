import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Glass, Field, tableWrap, thCls, tdCls, Empty, StatusBadge } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — K POINT BAR" }] }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const list = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
  if (!isAdmin) return <Empty text={t("noPermission")} />;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("required"));
    const { error } = await supabase.from("suppliers").insert({ name: name.trim(), phone, notes });
    if (error) return toast.error(errMsg(error));
    setName(""); setPhone(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["suppliers-all"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  }
  async function toggle(id: string, active: boolean) {
    await supabase.from("suppliers").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["suppliers-all"] });
  }

  return (
    <div>
      <PageHeader title={t("suppliers")} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Glass>
          <form onSubmit={add} className="grid gap-3">
            <Field label={t("name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t("phone")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label={t("notes")}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <Button variant="hero" type="submit">{t("add")}</Button>
          </form>
        </Glass>
        <Glass className="lg:col-span-2">
          <div className={tableWrap}>
            <table className="w-full">
              <thead className="bg-muted/40"><tr><th className={thCls}>{t("name")}</th><th className={thCls}>{t("phone")}</th><th className={thCls}>{t("notes")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></tr></thead>
              <tbody>
                {(list.data ?? []).length === 0 && <tr><td colSpan={5} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
                {(list.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className={tdCls + " font-medium"}>{s.name}</td><td className={tdCls}>{s.phone}</td><td className={tdCls}>{s.notes}</td>
                    <td className={tdCls}><StatusBadge status={s.active ? "active" : "inactive"} label={t(s.active ? "active" : "inactive")} /></td>
                    <td className={tdCls}><Button size="sm" variant="ghost" onClick={() => toggle(s.id, !s.active)}>{t(s.active ? "deactivate" : "activate")}</Button></td>
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
