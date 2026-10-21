import { supabase } from "@/integrations/supabase/client";
import type { SaleRow } from "./reports";

export async function fetchRange(from: string, to: string) {
  const [sales, expenses, income, purchases] = await Promise.all([
    supabase
      .from("sales")
      .select("business_date, employee_id, payment_method, total, cost_total, sale_items(product_id, quantity, line_total, unit_cost, products(name, category))")
      .gte("business_date", from)
      .lte("business_date", to)
      .limit(10000),
    supabase.from("expenses").select("*").gte("business_date", from).lte("business_date", to).limit(10000),
    supabase.from("other_income").select("*").gte("business_date", from).lte("business_date", to).limit(10000),
    supabase.from("purchases").select("*, suppliers(name)").gte("business_date", from).lte("business_date", to).limit(10000),
  ]);
  const saleRows: SaleRow[] = (sales.data ?? []).map((s) => ({
    business_date: s.business_date,
    employee_id: s.employee_id,
    payment_method: s.payment_method,
    total: Number(s.total),
    cost_total: Number(s.cost_total),
    items: s.sale_items.map((i) => ({
      product_id: i.product_id,
      name: i.products?.name ?? "",
      category: i.products?.category ?? "",
      quantity: Number(i.quantity),
      line_total: Number(i.line_total),
      unit_cost: Number(i.unit_cost),
    })),
  }));
  return {
    sales: saleRows,
    expenses: (expenses.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })),
    income: (income.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })),
    purchases: (purchases.data ?? []).map((p) => ({ ...p, total: Number(p.total) })),
  };
}
