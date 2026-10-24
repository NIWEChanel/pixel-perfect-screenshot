import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useProducts, useSettings, useProfilesMap, errMsg } from "@/lib/data";
import { fmtMoney, fmtNum, kigaliToday } from "@/lib/format";
import { validateSale } from "@/lib/stock-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Glass, Field, selectCls, tableWrap, thCls, tdCls } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — K POINT BAR" }, { name: "description", content: "Record K POINT BAR sales and review daily transactions." }, { property: "og:title", content: "Sales — K POINT BAR" }, { property: "og:description", content: "Record K POINT BAR sales and review daily transactions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SalesPage,
});

type Line = { product_id: string; quantity: string };
export const PAYMENT_METHODS = ["cash", "momo", "card", "bank", "credit"] as const;

function SalesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: products = [], error: productsError } = useProducts();
  const { data: settings } = useSettings();
  const { data: names = {} } = useProfilesMap();
  const cur = settings?.currency ?? "RWF";
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "1" }]);
  const [pm, setPm] = useState<string>("cash");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(kigaliToday());

  const sales = useQuery({
    queryKey: ["sales", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(quantity, unit_price, line_total, products(name))")
        .eq("business_date", day)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pmap = Object.fromEntries(products.map((p) => [p.id, p]));
  const total = lines.reduce((s, l) => {
    const p = pmap[l.product_id];
    const quantity = Number(l.quantity);
    return s + (p?.selling_price != null && Number.isFinite(quantity) && quantity > 0 ? Math.round(Number(p.selling_price) * quantity * 100) / 100 : 0);
  }, 0);

  async function submit() {
    if (busy) return;
    const validation = validateSale(lines, products);
    if (validation) return toast.error(t(validation));
    const items = lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) }));
    setBusy(true);
    try {
      const { error } = await supabase.rpc("record_sale", { _items: items, _payment_method: pm, _reference: ref, _notes: notes });
      if (error) throw error;
      toast.success(t("saleRecorded"));
      setLines([{ product_id: "", quantity: "1" }]);
      setRef(""); setNotes("");
      setDay(kigaliToday());
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  const dayTotal = (sales.data ?? []).reduce((s, x) => s + Number(x.total), 0);

  return (
    <div>
      <PageHeader title={t("sales")} />
      {productsError && <p role="alert" className="mb-3 text-destructive">{t("loadError")}: {errMsg(productsError)}</p>}
      <div className="grid gap-4 lg:grid-cols-5">
        <Glass className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{t("newSale")}</h2>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const p = pmap[l.product_id];
              return (
                <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2">
                  <div className="col-span-3 min-w-0">
                    <select aria-label={`${t("product")} ${i + 1}`} className={selectCls + " min-w-0"} value={l.product_id}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}>
                      <option value="">{t("product")}…</option>
                      <optgroup label={t("drinks")}>
                        {products.filter((p) => p.category === "drinks").map((p) => (
                          <option key={p.id} value={p.id} disabled={p.selling_price == null || Number(p.current_stock) <= 0}>
                            {p.name} ({fmtNum(Number(p.current_stock))}){p.selling_price == null ? ` — ${t("notSet")}` : ""}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("kitchen")}>
                        {products.filter((p) => p.category === "kitchen").map((p) => (
                          <option key={p.id} value={p.id} disabled={p.selling_price == null || Number(p.current_stock) <= 0}>
                            {p.name} ({fmtNum(Number(p.current_stock))}){p.selling_price == null ? ` — ${t("notSet")}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <Input aria-label={`${t("quantity")} ${i + 1}`} type="number" min={0.001} step={0.001} className="w-full" value={l.quantity}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                  <div className="text-right text-sm text-muted-foreground">
                    {p?.selling_price != null ? fmtMoney(Number(p.selling_price) * Math.max(0, Number(l.quantity || 0)), cur) : "—"}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label={t("delete")}>
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { product_id: "", quantity: "1" }])}>
              <Plus /> {t("addItem")}
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label={t("paymentMethod")}>
              <select className={selectCls} value={pm} onChange={(e) => setPm(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label={t("reference")}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            <div className="col-span-2"><Field label={t("notes")}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="font-display text-2xl font-semibold text-primary">{fmtMoney(total, cur)}</span>
          </div>
          <Button variant="hero" className="mt-4 h-11 w-full" onClick={submit} disabled={busy || !!productsError}>
            {busy && <Loader2 className="animate-spin" />} {t("recordSale")}
          </Button>
        </Glass>
        <Glass className="lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("recentSales")}</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("total")}: <b className="text-foreground">{fmtMoney(dayTotal, cur)}</b></span>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-40" />
            </div>
          </div>
          <div className={tableWrap}>
            <table className="w-full">
              <thead className="bg-muted/40"><tr>
                <th className={thCls}>{t("date")}</th><th className={thCls}>{t("product")}</th>
                <th className={thCls}>{t("paymentMethod")}</th><th className={thCls}>{t("user")}</th>
                <th className={thCls + " text-right"}>{t("total")}</th>
              </tr></thead>
              <tbody>
                {sales.isPending && <tr><td colSpan={5} className={tdCls}>{t("loading")}</td></tr>}
                {sales.error && <tr><td colSpan={5} className={tdCls + " text-destructive"} role="alert">{t("loadError")}: {errMsg(sales.error)}</td></tr>}
                {!sales.isPending && !sales.error && (sales.data ?? []).length === 0 && <tr><td colSpan={5} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
                {(sales.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td className={tdCls}>{new Date(s.created_at).toLocaleTimeString()}</td>
                    <td className={tdCls + " whitespace-normal"}>
                      {s.sale_items.map((it, i) => (
                        <div key={i}>{fmtNum(Number(it.quantity))} × {it.products?.name} @ {fmtMoney(Number(it.unit_price), cur)}</div>
                      ))}
                    </td>
                    <td className={tdCls}>{s.payment_method.toUpperCase()}{s.reference ? ` · ${s.reference}` : ""}</td>
                    <td className={tdCls}>{names[s.employee_id] ?? "—"}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtMoney(Number(s.total), cur)}</td>
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
