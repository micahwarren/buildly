export type PurchaseMaterial = {
  quantity: number;
  quantityUnit?: string;
  unitCost?: number;
  purchase?: { label?: string; coverage?: number; wholeUnits?: boolean };
};
const positive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Prices and quantities use the same unit; discrete stock/packages round up. */
export function materialPurchase(m: PurchaseMaterial) {
  const quantity = positive(m.quantity) ? m.quantity : 0;
  const coverage = positive(m.purchase?.coverage) ? m.purchase.coverage : null;
  const bulk =
    /\bbulk\b/i.test(m.purchase?.label || "") &&
    /cubic|cu\s*\.?\s*(yd|ft)|tons?|tonnes?|linear|sq\b|square|gallons?|lit[er]{2}/i.test(
      m.quantityUnit || "",
    );
  const wholeUnits = m.purchase?.wholeUnits ?? !bulk;
  const ratio = quantity && coverage ? quantity / coverage : null;
  const count =
    ratio !== null && Number.isFinite(ratio)
      ? wholeUnits
        ? Math.ceil(ratio)
        : ratio
      : null;
  const unitPrice = positive(m.unitCost) ? m.unitCost : null;
  const rawPackagePrice =
    unitPrice !== null && coverage !== null ? unitPrice * coverage : null;
  const packagePrice = positive(rawPackagePrice)
    ? money(rawPackagePrice) || rawPackagePrice
    : null;
  const rawTotal =
    quantity && unitPrice !== null
      ? count !== null && packagePrice !== null
        ? count * packagePrice
        : quantity * unitPrice
      : null;
  const total = positive(rawTotal) ? money(rawTotal) || null : null;
  return {
    quantity,
    coverage,
    wholeUnits,
    count,
    unitPrice,
    packagePrice,
    total,
  };
}
