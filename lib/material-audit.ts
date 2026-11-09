import { materialPurchase } from "./material-purchase";
import type { Material } from "./project";

/** Broad outlier checks, not a price list or a replacement for product review. */
export function materialAuditIssues(materials: Material[]) {
  const issues: string[] = [];
  materials.forEach((m, index) => {
    const unit = (m.quantityUnit || "").trim().toLowerCase();
    const each =
      /^(each|ea\.?|piece|pieces|count|fasteners?|screws?|nails?)$/.test(unit);
    const ordinaryFastener =
      /\bscrews?\b|\bnails?\b/i.test(m.item) &&
      !/\b(structural|lag|anchor|bolt|rod|assembly|kit)\b/i.test(m.item);
    const purchase = materialPurchase(m);
    const label = m.purchase?.label || "";
    const count = /\b(\d{1,6})\s*[- ]?(?:count|ct\b|pieces?\b|pcs\b)/i.exec(
      label,
    );
    if (each && count && m.purchase?.coverage !== Number(count[1]))
      issues.push(
        `material ${index + 1}: package coverage disagrees with its count label`,
      );
    if (
      /^(boxes|box|packs?|bags?|rolls?|sheets?|boards?|kits?)$/.test(unit) &&
      m.purchase?.coverage &&
      m.purchase.coverage !== 1 &&
      /\b(box|pack|bag|roll|sheet|board|kit)\b/i.test(label)
    )
      issues.push(
        `material ${index + 1}: a package quantity is being multiplied by another package coverage`,
      );
    if (ordinaryFastener && each && m.unitCost > 5)
      issues.push(
        `material ${index + 1}: ordinary fastener per-piece price appears to be a package price`,
      );
    if (
      ordinaryFastener &&
      purchase.packagePrice !== null &&
      purchase.packagePrice > 1000
    )
      issues.push(
        `material ${index + 1}: ordinary fastener package price is implausibly high`,
      );
    if (
      (/^(sq\.?\s*ft|square feet|square foot)$/.test(unit) &&
        m.unitCost > 1000) ||
      (/^(linear ft|linear feet|linear foot)$/.test(unit) && m.unitCost > 500)
    )
      issues.push(
        `material ${index + 1}: reference unit price is an extreme outlier`,
      );
  });
  return issues;
}
