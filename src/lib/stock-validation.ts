export type SaleLine = { product_id: string; quantity: string };
type AvailableProduct = { id: string; current_stock: number; selling_price: number | null; archived: boolean };

export function validQuantity(value: number) {
  return Number.isFinite(value) && value !== 0 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
}

export function validateSale(lines: SaleLine[], products: AvailableProduct[]): string | null {
  if (!lines.length) return "addItem";
  const totals = new Map<string, number>();
  for (const line of lines) {
    const p = products.find((product) => product.id === line.product_id);
    if (!p || p.archived) return "selectProduct";
    const quantity = Number(line.quantity);
    if (!validQuantity(quantity) || quantity <= 0) return "invalidQuantity";
    if (p.selling_price == null) return "notSet";
    const total = (totals.get(p.id) ?? 0) + quantity;
    if (total > Number(p.current_stock) + 0.0000001) return "insufficientStock";
    totals.set(p.id, total);
  }
  return null;
}

export function validateAdjustment(type: string, quantity: number, cost: number): string | null {
  if (!validQuantity(quantity) || (type !== "adjustment" && quantity <= 0)) return "invalidQuantity";
  if (!Number.isFinite(cost) || cost < 0) return "invalidCost";
  return null;
}