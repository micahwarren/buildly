"use client";
import { useEffect, useRef, useState } from "react";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { accountFetch, purchasesFor } from "@/lib/billing/client";
import { isNativeApp } from "@/lib/native";
export function Paywall({
  userId,
  close,
  onContinue,
}: {
  userId: string;
  close: () => void;
  onContinue?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [product, setProduct] = useState<PurchasesPackage | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [balance, setBalance] = useState<number | null>(null);
  async function refresh() {
    const res = await accountFetch("/api/billing/status");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setBalance(data.credits);
    return data.credits as number;
  }
  useEffect(() => {
    dialog.current?.showModal();
    let alive = true;
    (async () => {
      try {
        await refresh();
        if (isNativeApp()) {
          const sdk = await purchasesFor(userId);
          const offers = await sdk.getOfferings();
          const item = offers.current?.availablePackages.find(
            (p) =>
              p.product.identifier ===
              process.env.NEXT_PUBLIC_PROJECT_PRODUCT_ID,
          );
          if (!item)
            throw new Error("Project purchases are not available yet.");
          if (alive) setProduct(item);
        }
      } catch (e) {
        if (alive)
          setMessage(
            e instanceof Error ? e.message : "Could not load purchases.",
          );
      }
    })();
    const element = dialog.current;
    return () => {
      alive = false;
      element?.close();
    };
  }, [userId]);
  async function buy() {
    if (!product || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await refresh();
      const sdk = await purchasesFor(userId);
      await sdk.purchasePackage({ aPackage: product });
      setMessage("Purchase received. Waiting for confirmation…");
      const previous = balance || 0;
      for (let i = 0; i < 10; i++) {
        const value = await refresh();
        if (value > previous) {
          setMessage("Your project credit is ready.");
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setMessage(
        "Apple is still confirming your purchase. Tap Refresh purchases shortly; do not buy again.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Purchase not completed. No access was granted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="account-dialog paywall"
      aria-labelledby="paywall-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <button
        className="dialog-close"
        aria-label="Close purchases"
        disabled={busy}
        onClick={close}
      >
        ×
      </button>
      <span className="eyebrow">ONE PROJECT. NO SUBSCRIPTION.</span>
      <h2 id="paywall-title">Make your idea a plan.</h2>
      <ul>
        <li>One AI design and matching project plan</li>
        <li>Materials, tools and detailed build steps</li>
        <li>Three design revisions for that project</li>
        <li>Retry an incomplete plan without using a revision</li>
      </ul>
      <p>
        Each purchase adds one project credit to your Buildly account. No
        recurring charge.
      </p>
      {balance !== null && (
        <p>
          <strong>
            {balance} unused project {balance === 1 ? "credit" : "credits"}
          </strong>
        </p>
      )}
      {balance !== null && balance > 0 && (
        <button
          className="primary"
          disabled={busy}
          onClick={onContinue || close}
        >
          {onContinue ? "Use credit & continue" : "Done"}
        </button>
      )}
      {isNativeApp() && !balance ? (
        <button
          className="primary"
          disabled={!product || busy}
          onClick={() => void buy()}
        >
          {busy
            ? "Confirming purchase…"
            : product
              ? `Buy one project · ${product.product.priceString}`
              : message
                ? "Purchases unavailable"
                : "Loading App Store price…"}
        </button>
      ) : !isNativeApp() && !balance ? (
        <p>
          Buy project credits in the Buildly iPhone app, then use them on any
          device signed into this account.
        </p>
      ) : null}
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          refresh()
            .then(() => setMessage("Purchase balance refreshed."))
            .catch((e) => setMessage(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Refresh purchases
      </button>
      <p className="muted">
        Consumed project credits cannot be restored by Apple. Unused credits and
        saved projects follow your Buildly account.
      </p>
      {message && <p role="status">{message}</p>}
      <p>
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy
        </a>{" "}
        ·{" "}
        <a href="/terms" target="_blank" rel="noreferrer">
          Terms
        </a>
      </p>
    </dialog>
  );
}
