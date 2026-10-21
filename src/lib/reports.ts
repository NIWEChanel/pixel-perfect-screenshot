/**
 * Financial conventions (documented):
 * - Revenue = sum of sale line totals at the historical selling price.
 * - COGS = sum of quantity × weighted-average unit cost captured at the moment of sale.
 * - Gross profit = Revenue − COGS (purchases are inventory, NOT an expense).
 * - Net (operating) profit = Gross profit + Other income − Approved/pending (non-rejected) expenses.
 */
export type SaleRow = {
  business_date: string;
  employee_id: string;
  payment_method: string;
  total: number;
  cost_total: number;
  items: { product_id: string; name: string; category: string; quantity: number; line_total: number; unit_cost: number }[];
};

export function summarize(input: {
  sales: SaleRow[];
  expenses: { amount: number; status: string }[];
  income: { amount: number }[];
  purchases: { total: number; status: string }[];
}) {
  const revenue = input.sales.reduce((s, x) => s + Number(x.total), 0);
  const cogs = input.sales.reduce((s, x) => s + Number(x.cost_total), 0);
  const drinks = sumCat(input.sales, "drinks");
  const kitchen = sumCat(input.sales, "kitchen");
  const expenses = input.expenses.filter((e) => e.status !== "rejected").reduce((s, e) => s + Number(e.amount), 0);
  const income = input.income.reduce((s, e) => s + Number(e.amount), 0);
  const purchases = input.purchases.filter((p) => p.status === "received").reduce((s, p) => s + Number(p.total), 0);
  const gross = revenue - cogs;
  return { revenue, cogs, drinks, kitchen, expenses, income, purchases, gross, net: gross + income - expenses };
}

function sumCat(sales: SaleRow[], cat: string) {
  return sales.reduce((s, x) => s + x.items.filter((i) => i.category === cat).reduce((a, i) => a + Number(i.line_total), 0), 0);
}

export function productPerformance(sales: SaleRow[], category?: string) {
  const m = new Map<string, { name: string; category: string; qty: number; revenue: number; cost: number }>();
  for (const s of sales)
    for (const i of s.items) {
      if (category && i.category !== category) continue;
      const r = m.get(i.product_id) ?? { name: i.name, category: i.category, qty: 0, revenue: 0, cost: 0 };
      r.qty += Number(i.quantity);
      r.revenue += Number(i.line_total);
      r.cost += Number(i.quantity) * Number(i.unit_cost);
      m.set(i.product_id, r);
    }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function salesByDay(sales: SaleRow[]) {
  const m = new Map<string, number>();
  for (const s of sales) m.set(s.business_date, (m.get(s.business_date) ?? 0) + Number(s.total));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
}
