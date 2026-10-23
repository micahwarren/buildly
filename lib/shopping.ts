import type { Material, Project } from "./project";
export type ShoppingEntry = {
  item: string;
  packageLabel: string;
  coverage: number;
  price: number | null;
  supplier: string;
  url: string;
  purchased: boolean;
  updatedAt: string;
};
export function packageCount(quantity: number, coverage: number) {
  return Number.isFinite(quantity) &&
    quantity > 0 &&
    Number.isFinite(coverage) &&
    coverage > 0
    ? Math.ceil(quantity / coverage)
    : null;
}
export function safeProductUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validShopping(value: unknown): value is ShoppingEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 80 &&
    value.every(
      (x) =>
        x &&
        typeof x.item === "string" &&
        x.item.length <= 200 &&
        typeof x.packageLabel === "string" &&
        x.packageLabel.length <= 200 &&
        Number.isFinite(x.coverage) &&
        x.coverage >= 0 &&
        x.coverage <= 1000000 &&
        (x.price === null ||
          (Number.isFinite(x.price) && x.price >= 0 && x.price <= 1000000)) &&
        typeof x.supplier === "string" &&
        x.supplier.length <= 200 &&
        typeof x.url === "string" &&
        x.url.length <= 2000 &&
        safeProductUrl(x.url) &&
        typeof x.purchased === "boolean" &&
        typeof x.updatedAt === "string" &&
        Number.isFinite(Date.parse(x.updatedAt)),
    )
  );
}
export function shoppingLine(material: Material, entry?: ShoppingEntry) {
  const coverage = entry?.coverage ?? material.purchase?.coverage ?? 0;
  const count = packageCount(material.quantity, coverage);
  return {
    coverage,
    count,
    label:
      entry?.packageLabel ||
      material.purchase?.label ||
      "Select a product / package",
    total:
      count !== null && entry?.price !== null && entry?.price !== undefined
        ? Math.round(count * entry.price * 100) / 100
        : null,
  };
}
export function shoppingText(project: Project) {
  return (
    `${project.title}\nSHOPPING WORKSHEET — verify product sizes and quantities before ordering\nSupplier quotes are entered by you, not live prices.\n\n` +
    project.materials
      .map((material) => {
        const entry = project.shopping?.find((e) => e.item === material.item);
        const line = shoppingLine(material, entry);
        return `${material.item}\nNeed: ${material.quantity || "Verify"} ${material.quantityUnit || material.dimensions}\nBuy: ${line.count ?? "Verify"} × ${line.label}\n${material.quantityBasis || ""}\n${material.purchase?.notes || ""}\nSupplier: ${entry?.supplier || "Not selected"}\nProduct: ${entry?.url || "Not selected"}\nYour package quote: ${entry?.price == null ? "Not entered" : `$${entry.price}`}\nQuoted line total: ${line.total === null ? "Not priced" : `$${line.total.toFixed(2)}`}\nPurchased: ${entry?.purchased ? "Yes" : "No"}`;
      })
      .join("\n\n")
  );
}
