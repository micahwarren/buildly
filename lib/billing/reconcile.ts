import { projectProducts } from "./products";
import { DesignError } from "../services/image-design";

type StorePurchase = {
  customer_id: string;
  product_id: string;
  store_purchase_identifier: string;
  environment: string;
  store: string;
  status: string;
  ownership: string;
  quantity: number;
};
const catalogs = new Map<
  string,
  { until: number; value: Map<string, string> }
>();
/** Only RevenueCat's server response can authorize a receipt. Never trust client amounts or identities. */
export async function reconcilePurchases(
  user: string,
  apply: (receipt: { transaction: string; credits: number }) => Promise<void>,
  request: typeof fetch = fetch,
) {
  const key = process.env.REVENUECAT_SECRET_API_KEY,
    project = process.env.REVENUECAT_PROJECT_ID;
  const app = process.env.REVENUECAT_APP_ID;
  if (!key || !project || !app)
    throw new DesignError(
      "Purchase verification is unavailable. Your purchase is saved.",
      503,
    );
  const base = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(project)}`;
  async function read(path: string) {
    const response = await request(base + path, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (response.status === 404) return { items: [], next_page: null };
    if (!response.ok) {
      console.warn("Purchase verification provider response", response.status);
      throw new DesignError(
        "Purchase verification is taking longer. Please check again.",
        503,
      );
    }
    return response.json();
  }
  const first = await read(
    `/customers/${encodeURIComponent(user)}/purchases?limit=100`,
  );
  if (!Array.isArray(first.items))
    throw new DesignError("Purchase verification is unavailable.", 503);
  if (!first.items.length) return;
  const cacheKey = `${project}:${app}`;
  // These are the existing published RevenueCat product identities for this app.
  // Customer-read credentials need not have broader product-catalog access.
  const siteCatalog =
    project === "projff09f31d" && app === "app0e2b28467b"
      ? new Map([
          ["prod6fd19e2ebf", "sightsaw.project.single"],
          ["prode8cc5fe6d1", "sightsaw.project.two"],
          ["prod4026aedadf", "sightsaw.project.four"],
        ])
      : null;
  let catalog = siteCatalog
    ? { until: Infinity, value: siteCatalog }
    : catalogs.get(cacheKey);
  if (!catalog || catalog.until <= Date.now()) {
    const result = await read(
      `/products?app_id=${encodeURIComponent(app)}&limit=100`,
    );
    if (!Array.isArray(result.items) || result.next_page)
      throw new DesignError("Store products could not be verified.", 503);
    catalog = {
      until: Date.now() + 300000,
      value: new Map(
        result.items
          .filter((x: { app_id: string }) => x.app_id === app)
          .map((x: { id: string; store_identifier: string }) => [
            x.id,
            x.store_identifier,
          ]),
      ),
    };
    catalogs.set(cacheKey, catalog);
  }
  const packs = new Map(
    projectProducts(process.env.REVENUECAT_PROJECT_PRODUCT_ID).map((p) => [
      p.productId,
      p.credits,
    ]),
  );
  let page = first;
  for (let n = 0; n < 10; n++) {
    for (const p of page.items as StorePurchase[]) {
      const units = packs.get(catalog.value.get(p.product_id) || "");
      if (
        p.customer_id !== user ||
        p.store !== "app_store" ||
        p.status !== "owned" ||
        p.ownership !== "purchased" ||
        p.quantity !== 1 ||
        !units
      )
        continue;
      if (
        p.environment !== "production" &&
        !(
          p.environment === "sandbox" &&
          process.env.BILLING_ALLOW_SANDBOX === "true"
        )
      )
        continue;
      if (
        typeof p.store_purchase_identifier !== "string" ||
        !/^[A-Za-z0-9._:-]{1,200}$/.test(p.store_purchase_identifier)
      )
        continue;
      await apply({
        transaction: `${p.environment.toUpperCase()}:${p.store_purchase_identifier}`,
        credits: units,
      });
    }
    if (!page.next_page) return;
    const next = new URL(page.next_page, base);
    const prefix = new URL(
      base + `/customers/${encodeURIComponent(user)}/purchases`,
    );
    if (next.origin !== prefix.origin || next.pathname !== prefix.pathname)
      throw new DesignError("Purchase verification could not finish.", 503);
    page = await read(
      next.pathname.replace(new URL(base).pathname, "") + next.search,
    );
    if (!Array.isArray(page.items))
      throw new DesignError("Purchase verification is unavailable.", 503);
  }
  throw new DesignError(
    "More purchases are still being checked. Please check again.",
    503,
  );
}
