import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/data";
import { PageHeader, Glass, Field, Stat } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — K POINT BAR" },
      { name: "description", content: "Business name, currency, contact details and closing deadline." },
      { property: "og:title", content: "Settings — K POINT BAR" },
      { property: "og:description", content: "Business name, currency, contact details and closing deadline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Form = {
  business_name: string;
  currency: string;
  address: string;
  phone: string;
  report_deadline: string;
};

const EMPTY: Form = { business_name: "K POINT BAR", currency: "RWF", address: "", phone: "", report_deadline: "23:59" };

function SettingsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      business_name: settings.business_name ?? "",
      currency: settings.currency ?? "RWF",
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      report_deadline: settings.report_deadline ?? "23:59",
    });
  }, [settings]);

  const counts = useQuery({
    queryKey: ["settings-counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const [p, u, r] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("daily_reports").select("id", { count: "exact", head: true }),
      ]);
      return { products: p.count ?? 0, users: u.count ?? 0, reports: r.count ?? 0 };
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("business_settings").update(form).eq("id", 1);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success(t("saved"));
  }

  if (!isAdmin) return <Glass>{t("noPermission")}</Glass>;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader title={t("settings")} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Glass className="lg:col-span-2">
          <form onSubmit={save} className="space-y-4">
            <Field label={t("businessName")}>
              <Input value={form.business_name} onChange={set("business_name")} maxLength={120} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("currency")}>
                <Input value={form.currency} onChange={set("currency")} maxLength={8} required />
              </Field>
              <Field label={t("deadline")}>
                <Input type="time" value={form.report_deadline} onChange={set("report_deadline")} required />
              </Field>
            </div>
            <Field label={t("phone")}>
              <Input value={form.phone} onChange={set("phone")} maxLength={32} />
            </Field>
            <Field label={t("address")}>
              <Input value={form.address} onChange={set("address")} maxLength={200} />
            </Field>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t("save")}
            </Button>
          </form>
        </Glass>
        <div className="grid gap-3">
          <Stat label={t("inventory")} value={counts.data?.products ?? "—"} />
          <Stat label={t("employees")} value={counts.data?.users ?? "—"} />
          <Stat label={t("closing")} value={counts.data?.reports ?? "—"} />
        </div>
      </div>
    </div>
  );
}
