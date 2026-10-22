import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Boxes, Wine, UtensilsCrossed, ShoppingCart, ClipboardCheck, Truck, Users2, Receipt, BedDouble,
  FileBarChart, Bell, UserCog, ScrollText, Settings, UserCircle, LogOut, Menu, X, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { strongPassword } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
  },
  component: AppShell,
});

type NavItem = { to: string; key: string; icon: typeof Boxes; admin?: boolean; perm?: "receive_stock" };
const NAV: NavItem[] = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/inventory", key: "inventory", icon: Boxes },
  { to: "/drinks", key: "drinks", icon: Wine },
  { to: "/kitchen", key: "kitchen", icon: UtensilsCrossed },
  { to: "/sales", key: "sales", icon: ShoppingCart },
  { to: "/closing", key: "closing", icon: ClipboardCheck },
  { to: "/purchases", key: "purchases", icon: Truck, perm: "receive_stock" },
  { to: "/suppliers", key: "suppliers", icon: Users2, admin: true },
  { to: "/expenses", key: "expenses", icon: Receipt },
  { to: "/income", key: "income", icon: BedDouble },
  { to: "/reports", key: "reports", icon: FileBarChart },
  { to: "/alerts", key: "alerts", icon: Bell },
  { to: "/employees", key: "employees", icon: UserCog, admin: true },
  { to: "/audit", key: "audit", icon: ScrollText, admin: true },
  { to: "/settings", key: "settings", icon: Settings, admin: true },
  { to: "/profile", key: "profile", icon: UserCircle },
];

function AppShell() {
  const { profile, isAdmin, loading, can } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("loading")}
      </div>
    );
  }
  if (!profile.active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>{t("accountInactive")}</p>
        <Button onClick={signOut}>{t("signOut")}</Button>
      </div>
    );
  }
  if (profile.must_change_password) return <ForcePasswordChange onSignOut={signOut} />;
  if (!profile.language) return <ChooseLanguage />;

  const items = NAV.filter((n) => (!n.admin || isAdmin) && (!n.perm || can(n.perm)));
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = loc.pathname === n.to;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
            )}
          >
            <n.icon className="h-4 w-4" /> {t(n.key)}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 px-3 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
        <Wine className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <p className="font-display text-sm font-semibold tracking-widest">K POINT BAR</p>
        <p className="text-xs text-muted-foreground">{isAdmin ? t("superAdmin") : t("salesManager")}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="mt-auto border-t border-border pt-3">
      <p className="truncate px-3 text-sm">{profile.full_name || profile.username}</p>
      <p className="truncate px-3 text-xs text-muted-foreground">@{profile.username}</p>
      <Button variant="ghost" className="mt-2 w-full justify-start" onClick={signOut}>
        <LogOut /> {t("signOut")}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto rounded-none border-y-0 border-l-0 p-3 md:flex">
        {brand}
        {nav}
        {footer}
      </aside>
      <header className="glass sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2 md:hidden">
        <p className="font-display text-sm font-semibold tracking-widest">K POINT BAR</p>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Menu">
          <Menu />
        </Button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-background/70 md:hidden" onClick={() => setOpen(false)}>
          <aside className="glass flex h-full w-72 flex-col overflow-y-auto rounded-none p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              {brand}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </Button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PasswordChangeForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!strongPassword(p1)) return setErr(t("pwRules"));
    if (p1 !== p2) return setErr(t("pwMismatch"));
    setBusy(true);
    // The backend itself requires the current password when a new one is set.
    const { error } = await supabase.auth.updateUser({ password: p1, current_password: cur });
    if (error) {
      setBusy(false);
      return setErr(/current password/i.test(error.message) ? t("invalidCreds") : error.message);
    }
    await supabase.rpc("mark_password_changed");
    setBusy(false);
    setCur(""); setP1(""); setP2("");
    toast.success(t("pwChanged"));
    await refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("currentPassword")}>
        <Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      </Field>
      <Field label={t("newPassword")} hint={t("pwRules")}>
        <Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} required />
      </Field>
      <Field label={t("confirmPassword")}>
        <Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} required />
      </Field>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" variant="hero" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} {t("changePassword")}
      </Button>
    </form>
  );
}

function ForcePasswordChange({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <h1 className="text-xl font-semibold">{t("changePassword")}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{t("mustChange")}</p>
        <PasswordChangeForm />
        <Button variant="ghost" className="mt-3 w-full" onClick={onSignOut}>{t("signOut")}</Button>
      </div>
    </main>
  );
}

function ChooseLanguage() {
  const { t, setLang, lang } = useI18n();
  const { profile, refresh } = useAuth();
  const [sel, setSel] = useState<Lang>(lang);
  async function save() {
    await supabase.from("profiles").update({ language: sel }).eq("id", profile!.id);
    setLang(sel);
    await refresh();
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <h1 className="mb-6 text-xl font-semibold">{t("chooseLanguage")}</h1>
        <div className="grid gap-2">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setSel(l.code)}
              className={cn("rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-accent", sel === l.code && "border-primary bg-primary/10 text-primary")}>
              {l.label}
            </button>
          ))}
        </div>
        <Button variant="hero" className="mt-6 w-full" onClick={save}>{t("continue")}</Button>
      </div>
    </main>
  );
}
