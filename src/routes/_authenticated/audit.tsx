import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useProfilesMap } from "@/lib/data";
import { PageHeader, Glass, Empty, Field, tableWrap, thCls, tdCls, selectCls } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, kigaliToday } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit logs — K POINT BAR" },
      { name: "description", content: "Every recorded action, with who did it and when." },
      { property: "og:title", content: "Audit logs — K POINT BAR" },
      { property: "og:description", content: "Every recorded action, with who did it and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const PAGE = 200;

function AuditPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { data: names = {} } = useProfilesMap();
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState(addDays(kigaliToday(), -30));
  const [to, setTo] = useState(kigaliToday());
  const [limit, setLimit] = useState(PAGE);

  const q = useQuery({
    queryKey: ["audit", user, action, from, to, limit],
    enabled: isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", `${from}T00:00:00Z`)
        .lte("created_at", `${to}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (user !== "all") query = query.eq("user_id", user);
      if (action.trim()) query = query.ilike("action", `%${action.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (!isAdmin) return <Glass>{t("noPermission")}</Glass>;

  const rows = q.data ?? [];

  return (
    <div>
      <PageHeader title={t("audit")} subtitle={`${rows.length} ${t("entries")}`} />
      <Glass className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={t("from")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t("to")}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={t("user")}>
            <select className={selectCls} value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="all">{t("all")}</option>
              {Object.entries(names).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("action")}>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("search")} />
          </Field>
        </div>
      </Glass>

      <div className={tableWrap}>
        <table className="w-full">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className={thCls}>{t("time")}</th>
              <th className={thCls}>{t("user")}</th>
              <th className={thCls}>{t("action")}</th>
              <th className={thCls}>{t("entity")}</th>
              <th className={thCls}>{t("details")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className={tdCls}>{new Date(r.created_at).toLocaleString()}</td>
                <td className={tdCls}>{names[r.user_id ?? ""] ?? "—"}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center gap-2">
                    <ScrollText className="h-3.5 w-3.5 text-primary" />
                    {r.action}
                  </span>
                </td>
                <td className={tdCls}>
                  {r.entity ?? "—"}
                  {r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}
                </td>
                <td className={`${tdCls} max-w-[28rem] truncate text-muted-foreground`}>
                  {r.details ? JSON.stringify(r.details) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isFetching && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
          </div>
        )}
        {!q.isFetching && !rows.length && <Empty text={t("noData")} />}
        {rows.length === limit && (
          <div className="flex justify-center p-3">
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
