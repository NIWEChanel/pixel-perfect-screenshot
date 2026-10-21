import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Wine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { usernameToEmail } from "@/lib/format";
import { ensureBootstrapAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — K POINT BAR" },
      { name: "description", content: "K POINT BAR inventory & sales management. Staff sign-in." },
      { property: "og:title", content: "Sign in — K POINT BAR" },
      { property: "og:description", content: "K POINT BAR inventory & sales management. Staff sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    ensureBootstrapAdmin().catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!username.trim() || !password) return;
    setBusy(true);
    const email = username.includes("@") ? username.trim().toLowerCase() : usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(/banned/i.test(error.message) ? t("accountInactive") : t("invalidCreds"));
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-end">
          <select
            aria-label={t("language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="glass rounded-full px-3 py-1.5 text-sm text-foreground"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code} className="bg-card">
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="glass rounded-3xl p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Wine className="h-7 w-7 text-primary-foreground" />
            </div>
            <p className="font-display text-sm font-semibold tracking-[0.3em] text-primary">K POINT BAR</p>
            <h1 className="mt-3 text-2xl font-semibold">{t("welcome")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="u" className="text-sm text-muted-foreground">{t("username")}</label>
              <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 bg-background/60" />
              {touched && !username.trim() && <p className="text-xs text-destructive">{t("required")}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="p" className="text-sm text-muted-foreground">{t("password")}</label>
              <div className="relative">
                <Input id="p" type={show ? "text" : "password"} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="h-11 bg-background/60 pr-11" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("hide") : t("show")}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {touched && !password && <p className="text-xs text-destructive">{t("required")}</p>}
            </div>
            {error && <div role="alert" className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</div>}
            <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
              {busy ? <><Loader2 className="animate-spin" /> {t("signingIn")}</> : t("signIn")}
            </Button>
            <button type="button" onClick={() => setForgot(true)} className="block w-full text-center text-sm text-primary hover:underline">
              {t("forgot")}
            </button>
          </form>
        </div>
      </div>
      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("forgot")}</DialogTitle>
            <DialogDescription>{t("forgotMsg")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  );
}
