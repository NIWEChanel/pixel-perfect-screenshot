import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useProducts, useSettings, errMsg } from "@/lib/data";
import { fmtMoney, fmtNum, kigaliToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Glass, Field, selectCls, tableWrap, thCls, tdCls, StatusBadge, Empty } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases — K POINT BAR" }] }),
  component: PurchasesPage,
});

type Line = { product_id: string; quantity: string; unit_cost: string };

function PurchasesPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "RWF";
  const [open, setOpen] = useState(false);

  const purchases = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("*, suppliers(name), purchase_items(quantity, unit_cost, line_total, products(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  if (!can("receive_stock")) return <Empty text={t("noPermission")} />;

  async function receive(id: string) {
    const { error } = await supabase.rpc("receive_purchase", { _purchase: id });
    if (error) return toast.error(errMsg(error));
    toast.success(t("received"));
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  async function cancel(id: string) {
    const { error } = await supabase.from("purchases").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["purchases"] });
  }

  return (
    <div>
      <PageHeader title={t("purchases")} actions={<Button variant="hero" onClick={() => setOpen(true)}><Plus /> {t("newPurchase")}</Button>} />
      <Glass>
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="bg-muted/40"><tr>
              <th className={thCls}>{t("date")}</th><th className={thCls}>{t("supplier")}</th><th className={thCls}>{t("invoice")}</th>
              <th className={thCls}>{t("product")}</th><th className={thCls}>{t("paymentStatus")}</th>
              <th className={thCls + " text-right"}>{t("total")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th>
            </tr></thead>
            <tbody>
              {(purchases.data ?? []).length === 0 && <tr><td colSpan={8} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
              {(purchases.data ?? []).map((p) => {
                const tot = p.purchase_items.reduce((s, i) => s + Number(i.line_total), 0);
                return (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className={tdCls}>{p.business_date}</td>
                    <td className={tdCls}>{p.suppliers?.name ?? "—"}</td>
                    <td className={tdCls}>{p.invoice_no}</td>
                    <td className={tdCls + " whitespace-normal"}>
                      {p.purchase_items.map((i, k) => <div key={k}>{fmtNum(Number(i.quantity))} × {i.products?.name} @ {fmtMoney(Number(i.unit_cost), cur)}</div>)}
                    </td>
                    <td className={tdCls}>{p.payment_status} · {p.payment_method}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtMoney(tot, cur)}</td>
                    <td className={tdCls}><StatusBadge status={p.status} label={t(p.status === "cancelled" ? "rejected" : p.status)} /></td>
                    <td className={tdCls}>
                      {p.status === "draft" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="hero" onClick={() => receive(p.id)}><CheckCircle2 /> {t("confirmReceipt")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancel(p.id)}>{t("cancel")}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>
      {open && <NewPurchase onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewPurchase({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").eq("active", true).order("name")).data ?? [],
  });
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(kigaliToday());
  const [ps, setPs] = useState("unpaid");
  const [pm, setPm] = useState("cash");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "", unit_cost: "" }]);
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0);

  async function save() {
    const items = lines.filter((l) => l.product_id && Number(l.quantity) > 0 && l.unit_cost !== "");
    if (!items.length) return toast.error(t("addItem"));
    setBusy(true);
    const { data: p, error } = await supabase
      .from("purchases")
      .insert({ supplier_id: supplier || null, invoice_no: invoice, business_date: date, payment_status: ps, payment_method: pm, total })
      .select("id")
      .single();
    if (error || !p) { setBusy(false); return toast.error(errMsg(error)); }
    const { error: e2 } = await supabase.from("purchase_items").insert(
      items.map((l) => ({ purchase_id: p.id, product_id: l.product_id, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
    );
    setBusy(false);
    if (e2) return toast.error(errMsg(e2));
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["purchases"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("newPurchase")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label={t("supplier")}>
            <select className={selectCls} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">—</option>
              {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("invoice")}><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
          <Field label={t("date")}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t("paymentStatus")}>
            <select className={selectCls} value={ps} onChange={(e) => setPs(e.target.value)}>
              <option value="unpaid">unpaid</option><option value="partial">partial</option><option value="paid">paid</option>
            </select>
          </Field>
          <Field label={t("paymentMethod")}>
            <select className={selectCls} value={pm} onChange={(e) => setPm(e.target.value)}>
              {["cash", "momo", "bank", "credit"].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </Field>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select className={selectCls + " flex-1"} value={l.product_id}
                onChange={(e) => {
                  const pr = products.find((p) => p.id === e.target.value);
                  setLines(lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value, unit_cost: x.unit_cost || (pr?.cost_price?.toString() ?? "") } : x)));
                }}>
                <option value="">{t("product")}…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input type="number" min={0} placeholder={t("quantity")} className="w-24" value={l.quantity}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              <Input type="number" min={0} placeholder={t("unitCost")} className="w-28" value={l.unit_cost}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { product_id: "", quantity: "", unit_cost: "" }])}><Plus /> {t("addItem")}</Button>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="font-display text-lg font-semibold text-primary">{t("total")}: {fmtMoney(total)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
            <Button variant="hero" onClick={save} disabled={busy}>{t("save")}</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Stock increases only after “{t("confirmReceipt")}”.</p>
      </DialogContent>
    </Dialog>
  );
}
