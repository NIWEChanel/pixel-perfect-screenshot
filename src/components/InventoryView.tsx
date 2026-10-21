import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, SlidersHorizontal, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useProducts, useSettings, errMsg } from "@/lib/data";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Glass, Field, selectCls, tableWrap, thCls, tdCls, StatusBadge, Stat } from "@/components/kit";

type Product = Tables<"products">;

export function InventoryView({ category }: { category?: "drinks" | "kitchen" }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { data: settings } = useSettings();
  const cur = settings?.currency ?? "RWF";
  const { data: products = [], isLoading } = useProducts(isAdmin);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(category ?? "all");
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [hist, setHist] = useState<Product | null>(null);

  const list = products.filter(
    (p) => (cat === "all" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
  );
  const value = list.reduce((s, p) => s + Number(p.current_stock) * Number(p.avg_cost), 0);
  const low = list.filter((p) => !p.archived && Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock)).length;
  const out = list.filter((p) => !p.archived && Number(p.current_stock) <= 0).length;

  const title = category ? t(category) : t("inventory");

  return (
    <div>
      <PageHeader
        title={title}
        actions={isAdmin && (
          <Button variant="hero" onClick={() => setEdit({ category: category ?? "drinks", unit: "pcs", min_stock: 0 })}>
            <Plus /> {t("newProduct")}
          </Button>
        )}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("product")} value={list.length} />
        <Stat label={t("stockValue")} value={fmtMoney(value, cur)} />
        <Stat label={t("lowStock")} value={low} tone={low ? "warn" : undefined} />
        <Stat label={t("outOfStock")} value={out} tone={out ? "bad" : undefined} />
      </div>
      <Glass>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background/60" />
          {!category && (
            <select className={selectCls + " max-w-[160px]"} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">{t("all")}</option>
              <option value="drinks">{t("drinks")}</option>
              <option value="kitchen">{t("kitchen")}</option>
            </select>
          )}
        </div>
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr>
                <th className={thCls}>{t("product")}</th>
                <th className={thCls}>SKU</th>
                <th className={thCls}>{t("unit")}</th>
                <th className={thCls + " text-right"}>{t("stock")}</th>
                <th className={thCls + " text-right"}>{t("minStock")}</th>
                <th className={thCls + " text-right"}>{t("costPrice")}</th>
                <th className={thCls + " text-right"}>{t("sellingPrice")}</th>
                <th className={thCls + " text-right"}>{t("stockValue")}</th>
                <th className={thCls}>{t("status")}</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className={tdCls} colSpan={10}>{t("loading")}</td></tr>}
              {list.map((p) => {
                const s = Number(p.current_stock);
                const st = p.archived ? "inactive" : s <= 0 ? "rejected" : s <= Number(p.min_stock) ? "pending" : "approved";
                const stLabel = p.archived ? t("inactive") : s <= 0 ? t("outOfStock") : s <= Number(p.min_stock) ? t("lowStock") : "OK";
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-accent/30">
                    <td className={tdCls + " font-medium"}>{p.name}</td>
                    <td className={tdCls + " text-muted-foreground"}>{p.sku}</td>
                    <td className={tdCls}>{p.unit}</td>
                    <td className={tdCls + " text-right font-semibold"}>{fmtNum(s)}</td>
                    <td className={tdCls + " text-right"}>{fmtNum(Number(p.min_stock))}</td>
                    <td className={tdCls + " text-right"}>{p.cost_price == null ? <span className="text-muted-foreground">{t("notSet")}</span> : fmtMoney(Number(p.avg_cost) || Number(p.cost_price), cur)}</td>
                    <td className={tdCls + " text-right"}>{p.selling_price == null ? <span className="text-warning">{t("notSet")}</span> : fmtMoney(Number(p.selling_price), cur)}</td>
                    <td className={tdCls + " text-right"}>{fmtMoney(s * Number(p.avg_cost), cur)}</td>
                    <td className={tdCls}><StatusBadge status={st} label={stLabel} /></td>
                    <td className={tdCls + " text-right"}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setHist(p)} aria-label={t("history")}><History /></Button>
                        {isAdmin && <Button size="icon" variant="ghost" onClick={() => setAdjust(p)} aria-label={t("adjustStock")}><SlidersHorizontal /></Button>}
                        {isAdmin && <Button size="icon" variant="ghost" onClick={() => setEdit(p)} aria-label={t("edit")}><Pencil /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>
      {edit && <ProductDialog product={edit} onClose={() => setEdit(null)} />}
      {adjust && <AdjustDialog product={adjust} onClose={() => setAdjust(null)} />}
      {hist && <HistoryDialog product={hist} onClose={() => setHist(null)} />}
    </div>
  );
}

function ProductDialog({ product, onClose }: { product: Partial<Product>; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState<Partial<Product>>(product);
  const [busy, setBusy] = useState(false);
  const num = (v: string) => (v === "" ? null : Number(v));

  async function save() {
    if (!f.name?.trim()) return toast.error(t("required"));
    setBusy(true);
    const payload = {
      name: f.name.trim().toUpperCase(),
      sku: f.sku?.trim() || null,
      category: f.category as "drinks" | "kitchen",
      unit: f.unit || "pcs",
      min_stock: Number(f.min_stock ?? 0),
      cost_price: f.cost_price ?? null,
      selling_price: f.selling_price ?? null,
      archived: !!f.archived,
    };
    const res = f.id
      ? await supabase.from("products").update(payload).eq("id", f.id)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (res.error) return toast.error(errMsg(res.error));
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["products"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{f.id ? t("edit") : t("newProduct")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label={t("name")}><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="SKU"><Input value={f.sku ?? ""} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label={t("category")}>
            <select className={selectCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="drinks">{t("drinks")}</option>
              <option value="kitchen">{t("kitchen")}</option>
            </select>
          </Field>
          <Field label={t("unit")}><Input value={f.unit ?? ""} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label={t("minStock")}><Input type="number" min={0} value={f.min_stock ?? 0} onChange={(e) => setF({ ...f, min_stock: Number(e.target.value) })} /></Field>
          <Field label={t("costPrice")}><Input type="number" min={0} value={f.cost_price ?? ""} onChange={(e) => setF({ ...f, cost_price: num(e.target.value) })} /></Field>
          <Field label={t("sellingPrice")}><Input type="number" min={0} value={f.selling_price ?? ""} onChange={(e) => setF({ ...f, selling_price: num(e.target.value) })} /></Field>
          {f.id && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} /> {t("archive")}
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button variant="hero" onClick={save} disabled={busy}>{t("save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [type, setType] = useState<"opening" | "adjustment" | "wastage">(Number(product.current_stock) === 0 ? "opening" : "adjustment");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(product.cost_price?.toString() ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(qty);
    if (!qty || !n) return toast.error(t("quantity"));
    if (!reason.trim()) return toast.error(t("reason"));
    setBusy(true);
    const { error } = await supabase.rpc("adjust_stock", {
      _product: product.id, _type: type, _qty: n, _cost: cost === "" ? 0 : Number(cost), _reason: reason,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["products"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("adjustStock")} — {product.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t("stock")}: {fmtNum(Number(product.current_stock))} {product.unit}</p>
        <div className="grid gap-3">
          <Field label={t("adjustType")}>
            <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="opening">{t("opening")} (+)</option>
              <option value="adjustment">{t("adjustment")} (+/−)</option>
              <option value="wastage">{t("wastage")} (−)</option>
            </select>
          </Field>
          <Field label={t("quantity")} hint={type === "adjustment" ? "Use a negative number to remove stock" : undefined}>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          {type === "opening" && <Field label={t("unitCost")}><Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>}
          <Field label={t("reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button variant="hero" onClick={save} disabled={busy}>{t("save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useI18n();
  const { data = [] } = useQuery({
    queryKey: ["movements", product.id],
    queryFn: async () => {
      const { data } = await supabase.from("stock_movements").select("*").eq("product_id", product.id).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("history")} — {product.name}</DialogTitle></DialogHeader>
        <div className={tableWrap + " max-h-[60vh] overflow-y-auto"}>
          <table className="w-full">
            <thead className="bg-muted/40"><tr>
              <th className={thCls}>{t("date")}</th><th className={thCls}>{t("adjustType")}</th>
              <th className={thCls + " text-right"}>{t("quantity")}</th><th className={thCls}>{t("reason")}</th>
            </tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan={4} className={tdCls + " text-muted-foreground"}>{t("noData")}</td></tr>}
              {data.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className={tdCls}>{new Date(m.created_at).toLocaleString()}</td>
                  <td className={tdCls}>{m.movement_type}</td>
                  <td className={tdCls + " text-right " + (Number(m.quantity) < 0 ? "text-destructive" : "text-success")}>{fmtNum(Number(m.quantity))}</td>
                  <td className={tdCls + " text-muted-foreground"}>{m.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
