import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { PasswordChangeForm } from "@/routes/_authenticated/route";
import { PageHeader, Glass, Field, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — K POINT BAR" },
      { name: "description", content: "Update your name, language and password." },
      { property: "og:title", content: "Profile — K POINT BAR" },
      { property: "og:description", content: "Update your name, language and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, isAdmin, refresh, can } = useAuth();
  const { t, lang, setLang } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name ?? "");
    const stored = profile.language as Lang | null;
    setSel(stored && LANGS.some((l) => l.code === stored) ? stored : lang);
  }, [profile, lang]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), language: sel })
      .eq("id", profile.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    setLang(sel);
    await refresh();
    qc.invalidateQueries({ queryKey: ["profiles-map"] });
    setBusy(false);
    toast.success(t("saved"));
  }

  const perms = [
    { label: t("permReceive"), ok: can("receive_stock") },
    { label: t("permExpenses"), ok: can("expenses") },
    { label: t("permExport"), ok: can("export") },
  ];

  return (
    <div>
      <PageHeader title={t("profile")} subtitle={`@${profile?.username ?? ""}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Glass>
          <form onSubmit={save} className="space-y-4">
            <Field label={t("fullName")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t("username")}>
              <Input value={profile?.username ?? ""} disabled />
            </Field>
            <Field label={t("language")}>
              <div className="grid grid-cols-3 gap-2">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setSel(l.code)}
                    className={cn(
                      "rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-accent",
                      sel === l.code && "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t("save")}
            </Button>
          </form>
        </Glass>
        <div className="space-y-4">
          <Glass>
            <h2 className="mb-3 font-semibold">{t("role")}</h2>
            <p className="text-sm">{isAdmin ? t("superAdmin") : t("salesManager")}</p>
            <h2 className="mt-5 mb-3 font-semibold">{t("permissions")}</h2>
            <ul className="space-y-2 text-sm">
              {perms.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-3">
                  <span>{p.label}</span>
                  <StatusBadge status={p.ok ? "active" : "inactive"} label={p.ok ? t("active") : t("inactive")} />
                </li>
              ))}
            </ul>
          </Glass>
          <Glass>
            <h2 className="mb-4 font-semibold">{t("changePassword")}</h2>
            <PasswordChangeForm />
          </Glass>
        </div>
      </div>
    </div>
  );
}
