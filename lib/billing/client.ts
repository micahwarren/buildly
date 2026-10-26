import { getAccountClient } from "../accounts/client";
import { isNativeApp } from "../native";
let identity = "";
export async function purchasesFor(userId: string) {
  if (!isNativeApp())
    throw new Error("Purchases are available in the Buildly iPhone app.");
  const key = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  if (!key) throw new Error("App Store purchases are not configured yet.");
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (!identity) await Purchases.configure({ apiKey: key, appUserID: userId });
  else if (identity !== userId) await Purchases.logIn({ appUserID: userId });
  identity = userId;
  return Purchases;
}
export async function accountFetch(url: string, init: RequestInit = {}) {
  const { data } = (await getAccountClient()?.auth.getSession()) || {
    data: { session: null },
  };
  const headers = new Headers(init.headers);
  if (data.session)
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 402 && typeof window !== "undefined")
    window.dispatchEvent(new Event("buildly:paywall"));
  if (response.status === 401 && typeof window !== "undefined")
    window.dispatchEvent(new Event("buildly:signin"));
  return response;
}
