import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2, UserPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { errMsg } from "@/lib/data";
import { createEmployee, resetEmployeePassword, setEmployeeActive } from "@/lib/admin.functions";
import { PageHeader, Glass, Empty, Field, StatusBadge, tableWrap, thCls, tdCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — K POINT BAR" },
      { name: "description", content: "Create staff accounts, set permissions and reset passwords." },
      { property: "og:title", content: "Employees — K POINT BAR" },
      { property: "og:description", content: "Create staff accounts, set permissions and reset passwords." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

const PASSWORD_SETS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*"];

function genPassword() {
  const all = PASSWORD_SETS.join("");
  let out = PASSWORD_SETS.map((s) => s[Math.floor(Math.random() * s.length)]).join("");
  while (out.length < 14) out += all[Math.floor(Math.random() * all.length)];
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function EmployeesPage() {
  const { t } = useI18n();
  const { isAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const [add, setAdd] = useState(false);
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["employees"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roles = new Map((r ?? []).map((x) => [x.user_id, x.role] as const));
      return (p ?? []).map((x) => ({ ...x, role: roles.get(x.id) ?? "sales_manager" }));
    },
  });

  async function reload() {
    await qc.invalidateQueries({ queryKey: ["employees"] });
  }

  async function toggle(id: string, active: boolean) {
    try {
      await setEmployeeActive({ data: { userId: id, active } });
      toast.success(t("saved"));
      await reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  if (!isAdmin) return <Glass>{t("noPermission")}</Glass>;

  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (e) => !term || e.username.toLowerCase().includes(term) || (e.full_name ?? "").toLowerCase().includes(term),
  );

  return (
    <div>
      <PageHeader
        title={t("employees")}
        actions={
          <Button variant="hero" onClick={() => setAdd(true)}>
            <UserPlus /> {t("newEmployee")}
          </Button>
        }
      />
      <Glass className="mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="max-w-sm" />
      </Glass>
      <div className={tableWrap}>
        <table className="w-full">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className={thCls}>{t("fullName")}</th>
              <th className={thCls}>{t("username")}</th>
              <th className={thCls}>{t("role")}</th>
              <th className={thCls}>{t("status")}</th>
              <th className={thCls}>{t("permReceive")}</th>
              <th className={thCls}>{t("permExpenses")}</th>
              <th className={thCls}>{t("permExport")}</th>
              <th className={thCls}>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-border/60 last:border-0">
                <td className={tdCls}>
                  {e.full_name || e.username}
                  {e.must_change_password && (
                    <span className="ml-2 text-xs text-warning">{t("mustChange")}</span>
                  )}
                </td>
                <td className={tdCls}>@{e.username}</td>
                <td className={tdCls}>{e.role === "super_admin" ? t("superAdmin") : t("salesManager")}</td>
                <td className={tdCls}>
                  <StatusBadge status={e.active ? "active" : "inactive"} label={e.active ? t("active") : t("inactive")} />
                </td>
                <td className={tdCls}>{e.can_receive_stock ? "✓" : "—"}</td>
                <td className={tdCls}>{e.can_record_expenses ? "✓" : "—"}</td>
                <td className={tdCls}>{e.can_export ? "✓" : "—"}</td>
                <td className={tdCls}>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReset({ id: e.id, name: e.full_name || e.username })}
                    >
                      <KeyRound /> {t("resetPassword")}
                    </Button>
                    {e.id !== profile?.id && (
                      <Button size="sm" variant="outline" onClick={() => toggle(e.id, !e.active)}>
                        {e.active ? t("deactivate") : t("activate")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isFetching && !rows.length && <Empty text={t("noData")} />}
      </div>

      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newEmployee")}</DialogTitle>
            <DialogDescription>{t("mustChange")}</DialogDescription>
          </DialogHeader>
          <NewEmployeeForm
            onDone={async () => {
              setAdd(false);
              await reload();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetPassword")}</DialogTitle>
            <DialogDescription>{reset?.name}</DialogDescription>
          </DialogHeader>
          {reset && (
            <ResetPasswordForm
              userId={reset.id}
              onDone={async () => {
                setReset(null);
                await reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewEmployeeForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(genPassword);
  const [recv, setRecv] = useState(true);
  const [exp, setExp] = useState(true);
  const [exportPerm, setExportPerm] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createEmployee({
        data: {
          username,
          full_name: fullName,
          password,
          can_receive_stock: recv,
          can_record_expenses: exp,
          can_export: exportPerm,
        },
      });
      toast.success(t("saved"));
      onDone();
    } catch (e2) {
      setErr(errMsg(e2));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("fullName")}>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
      </Field>
      <Field label={t("username")} hint="a-z 0-9 . _ -  (3-32)">
        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label={t("tempPassword")} hint={t("pwRules")}>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <Button type="button" size="icon" variant="outline" aria-label={t("generate")} onClick={() => setPassword(genPassword())}>
            <Wand2 />
          </Button>
        </div>
      </Field>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={recv} onCheckedChange={(v) => setRecv(v === true)} /> {t("permReceive")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={exp} onCheckedChange={(v) => setExp(v === true)} /> {t("permExpenses")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={exportPerm} onCheckedChange={(v) => setExportPerm(v === true)} /> {t("permExport")}
        </label>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" variant="hero" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} {t("add")}
      </Button>
    </form>
  );
}

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState(genPassword);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await resetEmployeePassword({ data: { userId, password } });
      toast.success(t("saved"));
      onDone();
    } catch (e2) {
      setErr(errMsg(e2));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("tempPassword")} hint={t("pwRules")}>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <Button type="button" size="icon" variant="outline" aria-label={t("generate")} onClick={() => setPassword(genPassword())}>
            <Wand2 />
          </Button>
        </div>
      </Field>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" variant="hero" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} {t("resetPassword")}
      </Button>
    </form>
  );
}
