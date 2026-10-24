import { describe, expect, it } from "vitest";
import { validateSale, validateAdjustment } from "@/lib/stock-validation";

const products = [{ id: "drink", current_stock: 5, selling_price: 1000, archived: false }];
describe("Sales and inventory validation", () => {
  it("does not silently omit incomplete sale lines", () => {
    expect(validateSale([{ product_id: "drink", quantity: "1" }, { product_id: "", quantity: "1" }], products)).toBe("selectProduct");
  });
  it("checks combined quantity for repeated products", () => {
    expect(validateSale([{ product_id: "drink", quantity: "3" }, { product_id: "drink", quantity: "3" }], products)).toBe("insufficientStock");
  });
  it("accepts exactly available stock", () => {
    expect(validateSale([{ product_id: "drink", quantity: "5" }], products)).toBeNull();
  });
  it("accepts a configured zero selling price", () => {
    expect(validateSale([{ product_id: "drink", quantity: "1" }], [{ id: "drink", current_stock: 5, archived: false, selling_price: 0 }])).toBeNull();
  });
  it("rejects quantities smaller than stock precision", () => {
    expect(validateSale([{ product_id: "drink", quantity: "0.0001" }], products)).toBe("invalidQuantity");
  });
  it("rejects negative opening stock", () => {
    expect(validateAdjustment("opening", -1, 800)).toBe("invalidQuantity");
  });
  it("allows negative corrections but not negative costs", () => {
    expect(validateAdjustment("adjustment", -1, 800)).toBeNull();
    expect(validateAdjustment("opening", 1, -800)).toBe("invalidCost");
  });
});